/**
 * Generate pre-rendered Shiki HTML for all .md files in the content directory.
 *
 * Writes a .highlighted.html file alongside each .md file. The Astro app
 * loads these pre-rendered files instead of running Shiki at request time,
 * keeping the production runtime lightweight.
 *
 * Usage:
 *   npx tsx scripts/generate-highlights.ts [content-dir] [--limit N] [--chunk-size N] [--source <name>]
 *
 * Options:
 *   content-dir    Path to content directory (default: ./content)
 *   --limit N      Process only the first N files (for testing)
 *   --chunk-size N Files per child process (default: 2000)
 *   --source <name> Only process a specific source: usc, ecfr, or fr
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
// --- Config ---

const THEME_NAMES = {
  light: "lexbuild-light" as const,
  dark: "lexbuild-dark" as const,
};

/** Files per child process. Each child gets its own Shiki instance and exits
 *  when done, fully releasing memory. 2k balances throughput vs memory —
 *  FR documents are ~10x larger than USC/eCFR sections. */
const DEFAULT_CHUNK_SIZE = 2_000;

/** Max V8 heap per child (MB). Prevents runaway growth from Shiki/gray-matter
 *  caches. If a child hits this limit it crashes and the parent reports it. */
const CHILD_MAX_OLD_SPACE_MB = 2048;

// --- Helpers ---

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

// --- Child process worker — highlight a chunk of files ---

async function runWorker(): Promise<void> {
  // Receive file list via IPC from parent (avoids OS env size limits)
  const { files, contentDir } = await new Promise<{ files: string[]; contentDir: string }>((resolve) => {
    process.once("message", (msg) => resolve(msg as { files: string[]; contentDir: string }));
  });

  const { createHighlighter } = await import("shiki");
  const { lexbuildLight: light, lexbuildDark: dark } = await import("../src/lib/shiki-themes");
  const highlighter = await createHighlighter({
    themes: [light, dark],
    langs: ["markdown"],
  });

  let processed = 0;
  let errors = 0;

  for (const mdPath of files) {
    try {
      const raw = await readFile(mdPath, "utf-8");
      // cache: false prevents unbounded memory growth in batch processing
      const { content: body } = matter(raw, { cache: false });

      const html = highlighter.codeToHtml(body, {
        lang: "markdown",
        themes: { light: THEME_NAMES.light, dark: THEME_NAMES.dark },
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

// --- Main — orchestrate child processes ---

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let contentDir = "./content";
  let limit = 0;
  let chunkSize = DEFAULT_CHUNK_SIZE;
  let sourceFilter: "usc" | "ecfr" | "fr" | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]!, 10);
      i++;
    } else if (args[i] === "--chunk-size" && args[i + 1]) {
      chunkSize = parseInt(args[i + 1]!, 10);
      i++;
    } else if (args[i] === "--source" && args[i + 1]) {
      const val = args[i + 1]!;
      if (val !== "usc" && val !== "ecfr" && val !== "fr") {
        console.error(`Invalid source: ${val}. Must be usc, ecfr, or fr.`);
        process.exit(1);
      }
      sourceFilter = val;
      i++;
    } else if (!args[i]!.startsWith("--")) {
      contentDir = args[i]!;
    }
  }

  const resolvedDir = resolve(contentDir);
  console.log(`Content directory: ${resolvedDir}`);
  if (sourceFilter) console.log(`Source filter: ${sourceFilter}`);
  console.log(`Finding .md files...`);

  let mdFiles = await findMdFiles(resolvedDir);

  // Filter by source path prefix when --source is set
  if (sourceFilter) {
    const sourcePathMap: Record<string, string> = {
      usc: "/usc/",
      ecfr: "/ecfr/",
      fr: "/fr/",
    };
    const prefix = sourcePathMap[sourceFilter]!;
    mdFiles = mdFiles.filter((f) => f.includes(prefix));
    console.log(`  Filtered to ${mdFiles.length} ${sourceFilter} files`);
  }
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
  const totalChunks = Math.ceil(toProcess.length / chunkSize);
  console.log(
    `\nProcessing ${toProcess.length} files in ${totalChunks} chunks of ${chunkSize} (heap limit: ${CHILD_MAX_OLD_SPACE_MB}MB)...`,
  );

  const startTime = performance.now();
  let totalProcessed = 0;
  let totalErrors = 0;
  const scriptPath = fileURLToPath(import.meta.url);

  for (let c = 0; c < totalChunks; c++) {
    const chunkStart = c * chunkSize;
    const chunkFiles = toProcess.slice(chunkStart, chunkStart + chunkSize);
    const chunkLabel = `Chunk ${c + 1}/${totalChunks} (${chunkFiles.length} files)`;
    console.log(`  ${chunkLabel}...`);

    const result = await new Promise<{ processed: number; errors: number }>((res, rej) => {
      const child = fork(scriptPath, ["--worker"], {
        stdio: ["pipe", "inherit", "inherit", "ipc"],
        execArgv: [...process.execArgv, `--max-old-space-size=${CHILD_MAX_OLD_SPACE_MB}`],
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
    console.log(`  ${chunkLabel} done — ${totalProcessed}/${toProcess.length} total (${elapsed}s, parent ${mem}MB)`);
  }

  const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone: ${totalProcessed} files highlighted, ${totalErrors} errors, ${totalTime}s`);
}

// --- Entry point — detect worker vs orchestrator mode ---

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
