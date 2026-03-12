/**
 * Upload local content to Vercel Blob storage.
 *
 * Uploads all files from content/ (section, chapter, title) and optionally
 * public/_pagefind/ to a Vercel Blob store, preserving directory structure
 * as blob pathnames.
 *
 * Prerequisites:
 *   - BLOB_READ_WRITE_TOKEN env var (run `vercel env pull` or set manually)
 *
 * Usage:
 *   npx tsx scripts/upload-to-blob.ts                    # Upload content only
 *   npx tsx scripts/upload-to-blob.ts --include-pagefind # Upload content + PageFind index
 *   npx tsx scripts/upload-to-blob.ts --dry-run          # Preview without uploading
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { put } from "@vercel/blob";

const CONTENT_DIR = join(import.meta.dirname, "..", "content");
const PAGEFIND_DIR = join(import.meta.dirname, "..", "public", "_pagefind");

const CONCURRENCY = 20;
const args = process.argv.slice(2);
const includePagfind = args.includes("--include-pagefind");
const dryRun = args.includes("--dry-run");

interface UploadStats {
  uploaded: number;
  skipped: number;
  errors: number;
  bytes: number;
}

/** Recursively collect all file paths under a directory. */
async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

/** Upload a single file to Vercel Blob. */
async function uploadFile(filePath: string, pathname: string, stats: UploadStats): Promise<void> {
  try {
    const content = await readFile(filePath);
    const fileStat = await stat(filePath);

    if (dryRun) {
      stats.uploaded++;
      stats.bytes += fileStat.size;
      return;
    }

    await put(pathname, content, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    stats.uploaded++;
    stats.bytes += fileStat.size;
  } catch (err) {
    stats.errors++;
    console.error(`  ERROR: ${pathname} — ${err instanceof Error ? err.message : err}`);
  }
}

/** Process files with bounded concurrency. */
async function uploadBatch(
  files: Array<{ filePath: string; pathname: string }>,
  stats: UploadStats,
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < files.length) {
      const i = index++;
      const file = files[i]!;
      await uploadFile(file.filePath, file.pathname, stats);

      // Progress update every 500 files
      if (stats.uploaded % 500 === 0 && stats.uploaded > 0) {
        const pct = ((stats.uploaded / files.length) * 100).toFixed(1);
        console.log(`  ${stats.uploaded}/${files.length} (${pct}%)`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
}

async function main(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !dryRun) {
    console.error("ERROR: BLOB_READ_WRITE_TOKEN not set.");
    console.error('Run "vercel env pull" or set the token manually.');
    process.exit(1);
  }

  console.log(dryRun ? "=== DRY RUN ===" : "=== Uploading to Vercel Blob ===");
  console.log();

  const allFiles: Array<{ filePath: string; pathname: string }> = [];

  // Collect content files (section/, chapter/, title/)
  for (const granularity of ["section", "chapter", "title"]) {
    const dir = join(CONTENT_DIR, granularity);
    const files = await collectFiles(dir);
    for (const filePath of files) {
      const pathname = `${granularity}/${relative(dir, filePath)}`;
      allFiles.push({ filePath, pathname });
    }
    console.log(`  ${granularity}/: ${files.length} files`);
  }

  // Optionally collect PageFind index
  if (includePagfind) {
    const files = await collectFiles(PAGEFIND_DIR);
    for (const filePath of files) {
      const pathname = `_pagefind/${relative(PAGEFIND_DIR, filePath)}`;
      allFiles.push({ filePath, pathname });
    }
    console.log(`  _pagefind/: ${files.length} files`);
  }

  console.log();
  console.log(`Total: ${allFiles.length} files`);
  console.log();

  const stats: UploadStats = { uploaded: 0, skipped: 0, errors: 0, bytes: 0 };
  const start = Date.now();

  await uploadBatch(allFiles, stats);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const mb = (stats.bytes / 1024 / 1024).toFixed(1);

  console.log();
  console.log(dryRun ? "=== DRY RUN COMPLETE ===" : "=== Upload Complete ===");
  console.log(`  Uploaded: ${stats.uploaded} files (${mb} MB)`);
  if (stats.errors > 0) console.log(`  Errors:   ${stats.errors}`);
  console.log(`  Time:     ${elapsed}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
