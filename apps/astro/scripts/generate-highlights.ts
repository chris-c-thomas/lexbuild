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
 * Memory management:
 *   Processes 300k+ files by forking child processes in batches. Each child
 *   handles a chunk of files with its own Shiki instance, then exits — fully
 *   releasing all memory. This avoids Shiki's internal grammar cache leak.
 */

import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { readdir } from "node:fs/promises";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const THEMES = {
  light: "github-light-default" as const,
  dark: "github-dark-default" as const,
};

/** Files per child process. Each child gets its own Shiki instance and exits
 *  when done, fully releasing memory. 10k keeps each child under ~2GB. */
const CHUNK_SIZE = 10_000;

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
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        !entry.name.startsWith("_") &&
        entry.name !== "README.md"
      ) {
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
// Child process worker — highlight a chunk of files
// ---------------------------------------------------------------------------

async function runWorker(): Promise<void> {
  // Receive file list via IPC from parent (avoids OS env size limits)
  const { files, contentDir } = await new Promise<{ files: string[]; contentDir: string }>(
    (resolve) => {
      process.once("message", (msg) => resolve(msg as { files: string[]; contentDir: string }));
    },
  );

  const { createHighlighter } = await import("shiki");
  const highlighter = await createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: ["markdown"],
  });

  let processed = 0;
  let errors = 0;

  for (const mdPath of files) {
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
    } catch (err) {
      errors++;
      const rel = relative(contentDir, mdPath);
      console.warn(`  Error: ${rel}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  highlighter.dispose();

  // Send result back to parent
  process.send!({ processed, errors });
}

// ---------------------------------------------------------------------------
// Main — orchestrate child processes
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

  // Split into chunks and process each in a child process
  const totalChunks = Math.ceil(toProcess.length / CHUNK_SIZE);
  console.log(
    `\nProcessing ${toProcess.length} files in ${totalChunks} chunks of ${CHUNK_SIZE}...`,
  );

  const startTime = performance.now();
  let totalProcessed = 0;
  let totalErrors = 0;
  const scriptPath = fileURLToPath(import.meta.url);

  for (let c = 0; c < totalChunks; c++) {
    const chunkStart = c * CHUNK_SIZE;
    const chunkFiles = toProcess.slice(chunkStart, chunkStart + CHUNK_SIZE);
    const chunkLabel = `Chunk ${c + 1}/${totalChunks} (${chunkFiles.length} files)`;
    console.log(`  ${chunkLabel}...`);

    const result = await new Promise<{ processed: number; errors: number }>((res, rej) => {
      const child = fork(scriptPath, ["--worker"], {
        stdio: ["pipe", "inherit", "inherit", "ipc"],
      });

      // Send file list via IPC (avoids OS env/arg size limits for large chunks)
      child.send({ files: chunkFiles, contentDir: resolvedDir });

      child.on("message", (msg) => res(msg as { processed: number; errors: number }));
      child.on("error", rej);
      child.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          rej(new Error(`Worker exited with code ${code}`));
        }
      });
    });

    totalProcessed += result.processed;
    totalErrors += result.errors;

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    const mem = (process.memoryUsage.rss() / 1024 / 1024).toFixed(0);
    console.log(
      `  ${chunkLabel} done — ${totalProcessed}/${toProcess.length} total (${elapsed}s, parent ${mem}MB)`,
    );
  }

  const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone: ${totalProcessed} files highlighted, ${totalErrors} errors, ${totalTime}s`);
}

// ---------------------------------------------------------------------------
// Entry point — detect worker vs orchestrator mode
// ---------------------------------------------------------------------------

if (process.argv.includes("--worker")) {
  runWorker()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
