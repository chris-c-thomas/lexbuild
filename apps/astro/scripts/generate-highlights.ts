/**
 * Generate pre-rendered Shiki HTML for all .md files in the content directory.
 *
 * Writes a .highlighted.html file alongside each .md file. The Astro app
 * loads these pre-rendered files instead of running Shiki at request time,
 * keeping the production runtime lightweight.
 *
 * Usage:
 *   npx tsx scripts/generate-highlights.ts [content-dir] [--limit N]
 *
 * Options:
 *   content-dir   Path to content directory (default: ./content)
 *   --limit N     Process only the first N files (for testing)
 *
 * Performance: ~60k files in ~2-5 minutes (Shiki is fast for Markdown).
 */

import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from "shiki";
import { readdir } from "node:fs/promises";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const THEMES = {
  light: "github-light-default" as const,
  dark: "github-dark-default" as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively find all .md files under a directory. */
async function findMdFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_") && entry.name !== "README.md") {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results;
}

/** Check if the highlight file is up-to-date (newer mtime than .md). */
async function isUpToDate(mdPath: string, htmlPath: string): Promise<boolean> {
  try {
    const [mdStat, htmlStat] = await Promise.all([stat(mdPath), stat(htmlPath)]);
    return htmlStat.mtimeMs >= mdStat.mtimeMs;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let contentDir = "./content";
  let limit = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]!, 10);
      i++;
    } else if (!args[i]!.startsWith("--")) {
      contentDir = args[i]!;
    }
  }

  const resolvedDir = resolve(contentDir);
  console.log(`Content directory: ${resolvedDir}`);
  console.log(`Finding .md files...`);

  let mdFiles = await findMdFiles(resolvedDir);
  console.log(`  Found ${mdFiles.length} .md files`);

  if (limit > 0) {
    mdFiles = mdFiles.slice(0, limit);
    console.log(`  Limited to ${limit} files`);
  }

  // Check which files need updating
  const toProcess: string[] = [];
  let skipped = 0;

  for (const mdPath of mdFiles) {
    const htmlPath = mdPath.replace(/\.md$/, ".highlighted.html");
    if (await isUpToDate(mdPath, htmlPath)) {
      skipped++;
    } else {
      toProcess.push(mdPath);
    }
  }

  console.log(`  ${skipped} already up-to-date, ${toProcess.length} to process`);

  if (toProcess.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  // Initialize Shiki
  console.log(`\nInitializing Shiki...`);
  let highlighter: HighlighterGeneric<BundledLanguage, BundledTheme> = await createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: ["markdown"],
  });
  console.log(`  Shiki ready`);

  // Process files — recreate Shiki every BATCH_SIZE files to prevent memory buildup
  const BATCH_SIZE = 50_000;
  const startTime = performance.now();
  let processed = 0;
  let errors = 0;

  for (let batchStart = 0; batchStart < toProcess.length; batchStart += BATCH_SIZE) {
    // Create a fresh highlighter for each batch to release Shiki's internal caches
    if (batchStart > 0) {
      highlighter.dispose();
      highlighter = await createHighlighter({
        themes: [THEMES.light, THEMES.dark],
        langs: ["markdown"],
      });
    }

    const batchEnd = Math.min(batchStart + BATCH_SIZE, toProcess.length);
    for (let i = batchStart; i < batchEnd; i++) {
      const mdPath = toProcess[i]!;
      try {
        const raw = await readFile(mdPath, "utf-8");
        const { content: body } = matter(raw);

        const html = highlighter.codeToHtml(body, {
          lang: "markdown",
          themes: { light: THEMES.light, dark: THEMES.dark },
        });

        const htmlPath = mdPath.replace(/\.md$/, ".highlighted.html");
        await writeFile(htmlPath, html, "utf-8");
        processed++;

        // Progress every 1000 files
        if (processed % 1000 === 0) {
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
          console.log(`  ${processed}/${toProcess.length} (${elapsed}s)`);
        }
      } catch (err) {
        errors++;
        const rel = relative(resolvedDir, mdPath);
        console.warn(`  Error: ${rel}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  highlighter.dispose();

  const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone: ${processed} files highlighted, ${errors} errors, ${totalTime}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
