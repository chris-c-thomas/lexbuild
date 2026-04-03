/**
 * `lexbuild ingest` command — reads converted markdown files and populates a SQLite database.
 *
 * Walks the content directory, parses frontmatter with gray-matter, hashes file
 * contents with SHA-256, and batch-upserts DocumentRow records into SQLite.
 * Supports incremental ingestion (skip unchanged files), source filtering,
 * and pruning of deleted documents.
 */

import { Command } from "commander";
import { resolve, relative, join } from "node:path";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import {
  SCHEMA_VERSION,
  DOCUMENTS_TABLE_SQL,
  SCHEMA_META_TABLE_SQL,
  INDEXES_SQL,
} from "@lexbuild/core";
import type { DocumentRow } from "@lexbuild/core";
import {
  createSpinner,
  summaryBlock,
  formatDuration,
  formatNumber,
  formatBytes,
  error,
} from "../ui.js";

/** Valid source types for the --source filter */
type SourceFilter = "usc" | "ecfr" | "fr";

/** Parsed options from the ingest command */
interface IngestCliOptions {
  db: string;
  source?: string | undefined;
  incremental?: boolean | undefined;
  prune?: boolean | undefined;
  batchSize: string;
  stats?: boolean | undefined;
}

/** Counters for ingestion progress */
interface IngestCounters {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

/** Sanitize an identifier into a safe primary key (same convention as Meilisearch). */
function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** Compute SHA-256 hash of file content for change detection. */
function computeHash(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/** Format RSS memory usage as a human-readable string. */
function formatRss(): string {
  const rss = process.memoryUsage.rss();
  return formatBytes(rss);
}

/**
 * Initialize the SQLite database: create tables, indexes, and set pragmas.
 *
 * Uses WAL mode for concurrent read access and performance pragmas
 * for batch ingestion workloads.
 */
function initializeDatabase(dbPath: string): DatabaseType {
  const db = new Database(dbPath);

  // Performance pragmas
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("cache_size = -64000"); // 64MB cache

  // Create tables
  db.exec(DOCUMENTS_TABLE_SQL);
  db.exec(SCHEMA_META_TABLE_SQL);

  // Create indexes
  for (const sql of INDEXES_SQL) {
    db.exec(sql);
  }

  // Seed/verify schema version
  const setVersion = db.prepare(
    "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)",
  );
  const getVersion = db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'");

  const row = getVersion.get() as { value: string } | undefined;
  if (row !== undefined) {
    const existingVersion = parseInt(row.value, 10);
    if (existingVersion !== SCHEMA_VERSION) {
      throw new Error(
        `Schema version mismatch: database has v${existingVersion}, code expects v${SCHEMA_VERSION}. ` +
          `Migration is required.`,
      );
    }
  } else {
    setVersion.run(String(SCHEMA_VERSION));
  }

  return db;
}

/**
 * Map parsed gray-matter frontmatter to a DocumentRow for SQLite insertion.
 *
 * Field mapping follows the phase spec exactly: chapter_number as String(),
 * positive_law as 0/1, agency as first element of agencies array,
 * multi-value fields as JSON-stringified arrays.
 */
function mapToDocumentRow(
  filePath: string,
  parsed: matter.GrayMatterFile<string>,
  contentHash: string,
): DocumentRow {
  const data = parsed.data as Record<string, unknown>;
  const identifier = data.identifier as string;
  const id = sanitizeId(identifier);

  const agencies = data.agencies as string[] | undefined;

  return {
    id,
    source: data.source as string,
    identifier,
    title_number: (data.title_number as number) ?? null,
    title_name: (data.title_name as string) ?? null,
    section_number: (data.section_number as string) ?? null,
    section_name: (data.section_name as string) ?? null,
    chapter_number: data.chapter_number != null ? String(data.chapter_number) : null,
    chapter_name: (data.chapter_name as string) ?? null,
    subchapter_number: (data.subchapter_number as string) ?? null,
    subchapter_name: (data.subchapter_name as string) ?? null,
    part_number: (data.part_number as string) ?? null,
    part_name: (data.part_name as string) ?? null,
    legal_status: data.legal_status as string,
    positive_law: data.positive_law ? 1 : 0,
    status: (data.status as string) ?? null,
    currency: (data.currency as string) ?? null,
    last_updated: (data.last_updated as string) ?? null,
    display_title: data.title as string,
    document_number: (data.document_number as string) ?? null,
    document_type: (data.document_type as string) ?? null,
    publication_date: (data.publication_date as string) ?? null,
    agency: Array.isArray(agencies) ? (agencies[0] ?? null) : ((data.agency as string) ?? null),
    fr_citation: (data.fr_citation as string) ?? null,
    fr_volume: (data.fr_volume as number) ?? null,
    effective_date: (data.effective_date as string) ?? null,
    comments_close_date: (data.comments_close_date as string) ?? null,
    fr_action: (data.fr_action as string) ?? null,
    authority: (data.authority as string) ?? null,
    regulatory_source: (data.regulatory_source as string) ?? null,
    cfr_part: (data.cfr_part as string) ?? null,
    cfr_subpart: (data.cfr_subpart as string) ?? null,
    agencies: agencies ? JSON.stringify(agencies) : null,
    cfr_references: data.cfr_references ? JSON.stringify(data.cfr_references) : null,
    docket_ids: data.docket_ids ? JSON.stringify(data.docket_ids) : null,
    source_credit: (data.source_credit as string) ?? null,
    frontmatter_yaml: parsed.matter.trim(),
    markdown_body: parsed.content,
    file_path: filePath,
    content_hash: contentHash,
    format_version: data.format_version as string,
    generator: data.generator as string,
    ingested_at: new Date().toISOString(),
  };
}

/**
 * Prepare the batch upsert statement and return a transaction function.
 *
 * Uses INSERT OR REPLACE for upsert semantics. Each batch is wrapped
 * in a single transaction for performance.
 */
function createBatchUpserter(db: DatabaseType): (rows: DocumentRow[]) => void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO documents (
      id, source, identifier, title_number, title_name,
      section_number, section_name, chapter_number, chapter_name,
      subchapter_number, subchapter_name, part_number, part_name,
      legal_status, positive_law, status, currency, last_updated,
      display_title, document_number, document_type, publication_date,
      agency, fr_citation, fr_volume, effective_date, comments_close_date,
      fr_action, authority, regulatory_source, cfr_part, cfr_subpart,
      agencies, cfr_references, docket_ids, source_credit,
      frontmatter_yaml, markdown_body, file_path, content_hash,
      format_version, generator, ingested_at
    ) VALUES (
      @id, @source, @identifier, @title_number, @title_name,
      @section_number, @section_name, @chapter_number, @chapter_name,
      @subchapter_number, @subchapter_name, @part_number, @part_name,
      @legal_status, @positive_law, @status, @currency, @last_updated,
      @display_title, @document_number, @document_type, @publication_date,
      @agency, @fr_citation, @fr_volume, @effective_date, @comments_close_date,
      @fr_action, @authority, @regulatory_source, @cfr_part, @cfr_subpart,
      @agencies, @cfr_references, @docket_ids, @source_credit,
      @frontmatter_yaml, @markdown_body, @file_path, @content_hash,
      @format_version, @generator, @ingested_at
    )
  `);

  return db.transaction((rows: DocumentRow[]) => {
    for (const row of rows) {
      insert.run(row);
    }
  });
}

/**
 * Recursively walk a directory and collect all .md file paths.
 *
 * Returns paths relative to the content directory root for consistent
 * storage in the database file_path column.
 */
function walkMarkdownFiles(dir: string, contentDir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath, contentDir));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      files.push(relative(contentDir, fullPath));
    }
  }

  return files;
}

/**
 * Get the list of sources to process based on the --source filter.
 * Returns source names and their corresponding display labels.
 */
function getSourcesToProcess(
  sourceFilter: SourceFilter | undefined,
): Array<{ source: SourceFilter; label: string }> {
  const allSources: Array<{ source: SourceFilter; label: string }> = [
    { source: "usc", label: "USC" },
    { source: "ecfr", label: "eCFR" },
    { source: "fr", label: "FR" },
  ];

  if (sourceFilter !== undefined) {
    const filtered = allSources.filter((s) => s.source === sourceFilter);
    if (filtered.length === 0) {
      throw new Error(`Unknown source: ${sourceFilter}. Valid sources: usc, ecfr, fr`);
    }
    return filtered;
  }

  return allSources;
}

/**
 * Ingest markdown files from a single source into the database.
 *
 * Handles file walking, content hashing, frontmatter parsing, and
 * batch upserts. Returns counters for the progress summary.
 */
function ingestSource(
  db: DatabaseType,
  contentDir: string,
  source: SourceFilter,
  label: string,
  batchSize: number,
  incremental: boolean,
  spinnerUpdate: (text: string) => void,
): IngestCounters {
  const sourceDir = join(contentDir, source);
  const counters: IngestCounters = { total: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

  if (!existsSync(sourceDir)) {
    return counters;
  }

  // Collect all markdown file paths
  const filePaths = walkMarkdownFiles(sourceDir, contentDir);
  counters.total = filePaths.length;

  if (filePaths.length === 0) {
    return counters;
  }

  // Prepare hash lookup for incremental mode
  let existingHashes: Map<string, string> | undefined;
  if (incremental) {
    existingHashes = new Map();
    const hashQuery = db.prepare(
      "SELECT file_path, content_hash FROM documents WHERE source = ?",
    );
    const rows = hashQuery.all(source) as Array<{ file_path: string; content_hash: string }>;
    for (const row of rows) {
      existingHashes.set(row.file_path, row.content_hash);
    }
  }

  const upsertBatch = createBatchUpserter(db);
  let batch: DocumentRow[] = [];
  let processed = 0;

  for (const filePath of filePaths) {
    processed++;

    // Update spinner periodically
    if (processed % 500 === 0 || processed === filePaths.length) {
      spinnerUpdate(
        `Ingesting ${label} (${formatNumber(processed)}/${formatNumber(filePaths.length)}) [RSS: ${formatRss()}]`,
      );
    }

    // Force GC every 50k files if available
    if (processed % 50_000 === 0 && global.gc) {
      global.gc();
    }

    try {
      const fullPath = join(contentDir, filePath);
      const rawContent = readFileSync(fullPath, "utf-8");
      const contentHash = computeHash(rawContent);

      // Incremental: skip if hash unchanged
      if (incremental && existingHashes !== undefined) {
        const existingHash = existingHashes.get(filePath);
        if (existingHash === contentHash) {
          counters.skipped++;
          continue;
        }
        // Determine if this is an update vs new insert
        if (existingHash !== undefined) {
          counters.updated++;
        } else {
          counters.inserted++;
        }
      } else {
        counters.inserted++;
      }

      // cache: false prevents unbounded memory growth in batch processing.
      // The option works at runtime but isn't in gray-matter's type definitions.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = matter(rawContent, { cache: false } as any);
      const row = mapToDocumentRow(filePath, parsed, contentHash);

      batch.push(row);

      if (batch.length >= batchSize) {
        upsertBatch(batch);
        batch = [];
      }
    } catch (err) {
      counters.errors++;
      // Log individual file errors but continue processing
      if (processed <= 5 || processed % 1000 === 0) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`  Warning: failed to process ${filePath}: ${msg}\n`);
      }
    }
  }

  // Flush remaining batch
  if (batch.length > 0) {
    upsertBatch(batch);
  }

  return counters;
}

/**
 * Prune documents from the database whose files no longer exist on disk.
 *
 * When --prune is passed, queries all file_path values from the database
 * (optionally filtered by source), checks if each exists on disk, and
 * deletes rows for missing files.
 */
function pruneDeletedDocuments(
  db: DatabaseType,
  contentDir: string,
  source: SourceFilter | undefined,
): number {
  const query = source
    ? db.prepare("SELECT id, file_path FROM documents WHERE source = ?")
    : db.prepare("SELECT id, file_path FROM documents");

  const rows = (source ? query.all(source) : query.all()) as Array<{
    id: string;
    file_path: string;
  }>;
  const toDelete: string[] = [];

  for (const row of rows) {
    const fullPath = join(contentDir, row.file_path);
    if (!existsSync(fullPath)) {
      toDelete.push(row.id);
    }
  }

  if (toDelete.length > 0) {
    const deleteStmt = db.prepare("DELETE FROM documents WHERE id = ?");
    const transaction = db.transaction((ids: string[]) => {
      for (const id of ids) {
        deleteStmt.run(id);
      }
    });
    transaction(toDelete);
  }

  return toDelete.length;
}

/**
 * Print corpus statistics from the database.
 *
 * Shows document counts per source, total database size, and
 * other useful metadata.
 */
function printStats(db: DatabaseType, dbPath: string): void {
  const sourceCountQuery = db.prepare(
    "SELECT source, COUNT(*) as count FROM documents GROUP BY source ORDER BY source",
  );
  const sourceCounts = sourceCountQuery.all() as Array<{ source: string; count: number }>;

  const totalQuery = db.prepare("SELECT COUNT(*) as count FROM documents");
  const totalResult = totalQuery.get() as { count: number };

  const dbSize = existsSync(dbPath) ? statSync(dbPath).size : 0;

  const rows: [string, string][] = [];
  for (const sc of sourceCounts) {
    const label = sc.source === "ecfr" ? "eCFR" : sc.source.toUpperCase();
    rows.push([label, `${formatNumber(sc.count)} documents`]);
  }
  rows.push(["Total", `${formatNumber(totalResult.count)} documents`]);
  rows.push(["DB size", formatBytes(dbSize)]);

  console.log(summaryBlock({ title: "Corpus Statistics", rows }));
}

export const ingestCommand = new Command("ingest")
  .description("Ingest converted markdown files into a SQLite database")
  .argument("[content-dir]", "Path to content directory", "./output")
  .option("--db <path>", "SQLite database file path", "./lexbuild.db")
  .option("--source <name>", "Only ingest a specific source: usc, ecfr, fr")
  .option("--incremental", "Only process files with changed content hashes")
  .option("--prune", "Remove documents from DB for files that no longer exist on disk")
  .option("--batch-size <n>", "Documents per transaction batch", "1000")
  .option("--stats", "Print corpus statistics after ingestion")
  .addHelpText(
    "after",
    `
Examples:
  $ lexbuild ingest ./output --db ./lexbuild.db
  $ lexbuild ingest ./output --db ./lexbuild.db --source fr --incremental
  $ lexbuild ingest ./output --db ./lexbuild.db --prune
  $ lexbuild ingest ./output --db ./lexbuild.db --batch-size 500
  $ lexbuild ingest ./output --db ./lexbuild.db --stats

Reads converted .md files from the content directory and populates a SQLite
database for the LexBuild Data API. Supports incremental ingestion via
SHA-256 content hashing, source-scoped filtering, and pruning of documents
whose source files have been deleted.`,
  )
  .action(async (contentDirArg: string, options: IngestCliOptions) => {
    const contentDir = resolve(contentDirArg);
    const dbPath = resolve(options.db);
    const sourceFilter = options.source as SourceFilter | undefined;
    const incremental = options.incremental === true;
    const prune = options.prune === true;
    const showStats = options.stats === true;
    const batchSize = parseInt(options.batchSize, 10);

    // Validate batch size
    if (isNaN(batchSize) || batchSize <= 0) {
      console.error(error("--batch-size must be a positive integer"));
      process.exit(1);
    }

    // Validate source filter
    if (sourceFilter !== undefined && !["usc", "ecfr", "fr"].includes(sourceFilter)) {
      console.error(error(`Invalid source: ${sourceFilter}. Valid sources: usc, ecfr, fr`));
      process.exit(1);
    }

    // Validate content directory exists
    if (!existsSync(contentDir)) {
      console.error(error(`Content directory not found: ${contentDir}`));
      process.exit(1);
    }

    // Print configuration
    const mode = incremental ? "incremental" : "full";
    console.log();
    console.log(`  Content directory: ${contentDir}`);
    console.log(`  Database: ${dbPath}`);
    console.log(`  Mode: ${mode}`);
    if (sourceFilter !== undefined) {
      console.log(`  Source filter: ${sourceFilter}`);
    }
    if (prune) {
      console.log(`  Pruning: enabled`);
    }
    console.log();

    const startTime = performance.now();

    let db: DatabaseType;
    try {
      db = initializeDatabase(dbPath);
    } catch (err) {
      console.error(error(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }

    try {
      const sources = getSourcesToProcess(sourceFilter);
      const totals: IngestCounters = { total: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

      for (const { source, label } of sources) {
        const spinner = createSpinner(`Ingesting ${label}`);
        spinner.start();

        const counters = ingestSource(
          db,
          contentDir,
          source,
          label,
          batchSize,
          incremental,
          (text) => {
            spinner.text = text;
          },
        );

        // Build per-source summary
        if (counters.total === 0) {
          spinner.info(`${label}: no files found`);
        } else if (incremental) {
          spinner.succeed(
            `${label}: ${formatNumber(counters.total)} documents ` +
              `(${formatNumber(counters.inserted)} new, ${formatNumber(counters.updated)} updated, ` +
              `${formatNumber(counters.skipped)} unchanged)`,
          );
        } else {
          spinner.succeed(`${label}: ${formatNumber(counters.inserted)} documents ingested`);
        }

        // Accumulate totals
        totals.total += counters.total;
        totals.inserted += counters.inserted;
        totals.updated += counters.updated;
        totals.skipped += counters.skipped;
        totals.errors += counters.errors;
      }

      // Pruning
      let pruned = 0;
      if (prune) {
        const pruneSpinner = createSpinner("Pruning deleted documents");
        pruneSpinner.start();
        pruned = pruneDeletedDocuments(db, contentDir, sourceFilter);
        if (pruned > 0) {
          pruneSpinner.succeed(`Pruned ${formatNumber(pruned)} documents`);
        } else {
          pruneSpinner.succeed("No documents to prune");
        }
      }

      const elapsed = performance.now() - startTime;
      const dbSize = existsSync(dbPath) ? statSync(dbPath).size : 0;

      // Summary block
      const summaryRows: [string, string][] = [
        ["Total", `${formatNumber(totals.total)} documents`],
      ];

      if (incremental) {
        summaryRows.push(["New", formatNumber(totals.inserted)]);
        summaryRows.push(["Updated", formatNumber(totals.updated)]);
        summaryRows.push(["Skipped", formatNumber(totals.skipped)]);
      } else {
        summaryRows.push(["Ingested", formatNumber(totals.inserted)]);
      }

      if (totals.errors > 0) {
        summaryRows.push(["Errors", formatNumber(totals.errors)]);
      }

      if (pruned > 0) {
        summaryRows.push(["Pruned", formatNumber(pruned)]);
      }

      summaryRows.push(["Duration", formatDuration(elapsed)]);
      summaryRows.push(["DB size", formatBytes(dbSize)]);

      console.log(summaryBlock({ title: "Ingestion Complete", rows: summaryRows }));

      // Optional stats
      if (showStats) {
        printStats(db, dbPath);
      }
    } catch (err) {
      console.error(error(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    } finally {
      db.close();
    }
  });
