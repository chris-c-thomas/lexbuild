/**
 * Incremental search index update for Meilisearch.
 *
 * Only indexes documents whose .md files have been modified since the last
 * successful run (mtime-based). Stores per-source checkpoint timestamps in
 * `<content-dir>/.search-indexed-at-{usc,ecfr,fr}`. On first run (no
 * checkpoint), indexes everything without deleting the existing index.
 * Falls back to a legacy `.search-indexed-at` global checkpoint if present.
 *
 * Indexes all three sources: USC, eCFR, and FR.
 * IMPORTANT: Keep sources, SearchDocument shape, and index configuration in
 * sync with `index-search.ts` (the full reindex script).
 *
 * Use `index-search.ts` for a full clean reindex (delete + rebuild).
 *
 * Usage:
 *   npx tsx scripts/index-search-incremental.ts [content-dir] [--prune] [--source <name>]
 *
 * Options:
 *   content-dir      Path to content directory (default: ./content)
 *   --prune          Remove documents from the index for sections that no longer
 *                    exist on disk (compares Meilisearch IDs against filesystem)
 *   --source <name>  Only index a specific source: usc, ecfr, or fr
 *   --set-checkpoint Write the checkpoint timestamp and exit (no indexing)
 *
 * Environment:
 *   MEILI_URL          Meilisearch endpoint (default: http://127.0.0.1:7700)
 *   MEILI_MASTER_KEY   Master key for admin operations (default: none for dev)
 */

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Meilisearch } from "meilisearch";
import matter from "gray-matter";

// --- Config ---

const MEILI_URL = process.env.MEILI_URL ?? "http://127.0.0.1:7700";
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY ?? "";
const INDEX_NAME = "lexbuild";
const BATCH_SIZE = 500;
const BODY_TRUNCATE_CHARS = 5000;
const CHECKPOINT_PREFIX = ".search-indexed-at";
const SOURCES = ["usc", "ecfr", "fr"] as const;

// --- Types ---

interface SearchDocument {
  id: string;
  source: "usc" | "ecfr" | "fr";
  title_number: number;
  title_name: string;
  granularity: string;
  identifier: string;
  heading: string;
  body: string;
  status: string;
  hierarchy: string[];
  url: string;
  document_type?: string;
  publication_date?: string;
}

interface UscTitleMeta {
  title_number: number;
  title_name: string;
  chapters: Array<{
    number: number;
    name: string;
    directory: string;
    sections: Array<{
      identifier: string;
      number: string;
      name: string;
      file: string;
      status: string;
    }>;
  }>;
}

interface EcfrTitleMeta {
  title_number: number;
  title_name: string;
}

interface EcfrPartMeta {
  part_number: string;
  part_name: string;
  title_number: number;
  sections: Array<{
    identifier: string;
    number: string;
    name: string;
    file: string;
    status: string;
  }>;
}

// --- Helpers ---

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function readTruncatedBody(mdPath: string): Promise<string> {
  try {
    const raw = await readFile(mdPath, "utf-8");
    // cache: false prevents unbounded memory growth in batch processing
    const { content } = matter(raw, { cache: false });
    const cleaned = content
      .replace(/^#{1,6}\s+.*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return cleaned.slice(0, BODY_TRUNCATE_CHARS);
  } catch {
    return "";
  }
}

async function getFileMtimeMs(path: string): Promise<number> {
  try {
    const s = await stat(path);
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

// --- Per-source checkpoints ---

function checkpointPath(contentDir: string, source: string): string {
  return join(contentDir, `${CHECKPOINT_PREFIX}-${source}`);
}

async function readSourceCheckpoint(contentDir: string, source: string): Promise<number> {
  try {
    const raw = await readFile(checkpointPath(contentDir, source), "utf-8");
    return parseInt(raw.trim(), 10);
  } catch {
    // Fall back to legacy global checkpoint for migration
    try {
      const raw = await readFile(join(contentDir, CHECKPOINT_PREFIX), "utf-8");
      return parseInt(raw.trim(), 10);
    } catch {
      return 0;
    }
  }
}

async function writeSourceCheckpoint(contentDir: string, source: string, timestamp: number): Promise<void> {
  await writeFile(checkpointPath(contentDir, source), String(timestamp), "utf-8");
}

// --- Batch sender ---

class BatchIndexer {
  private batch: SearchDocument[] = [];
  private totalSent = 0;
  private batchesSent = 0;
  private readonly startTime = performance.now();

  constructor(
    private readonly client: Meilisearch,
    private readonly indexName: string,
    private readonly batchSize: number,
  ) {}

  async add(doc: SearchDocument): Promise<void> {
    this.batch.push(doc);
    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    // Move batch to local var BEFORE sending — prevents cascading failures
    // if Meilisearch is down (otherwise the stale batch retriggers on every add)
    const toSend = this.batch;
    this.batch = [];

    const index = this.client.index(this.indexName);
    const task = await index.addDocuments(toSend);
    await this.client.tasks.waitForTask(task.taskUid, { timeout: 300_000 });

    this.totalSent += toSend.length;
    this.batchesSent++;

    if (this.batchesSent % 5 === 0) {
      const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(1);
      const mem = (process.memoryUsage.rss() / 1024 / 1024).toFixed(0);
      console.log(`  ${this.totalSent} docs upserted (${elapsed}s, ${mem}MB RSS)`);
    }
  }

  get total(): number {
    return this.totalSent;
  }

  get elapsed(): string {
    return ((performance.now() - this.startTime) / 1000).toFixed(1);
  }
}

// --- USC — walk, diff, and upsert ---

async function indexUscIncremental(
  contentDir: string,
  indexer: BatchIndexer,
  checkpoint: number,
  expectedIds: Set<string>,
): Promise<{ indexed: number; skipped: number }> {
  const uscDir = join(contentDir, "usc", "sections");
  const titleDirs = (await listDirs(uscDir)).filter((d) => d.startsWith("title-"));
  let indexed = 0;
  let skipped = 0;

  for (const titleDir of titleDirs) {
    const meta = await readJson<UscTitleMeta>(join(uscDir, titleDir, "_meta.json"));
    if (!meta) continue;

    for (const chapter of meta.chapters) {
      for (const section of chapter.sections) {
        const mdPath = join(uscDir, titleDir, chapter.directory, section.file);
        const docId = sanitizeId(`usc-${titleDir}-${section.file.replace(/\.md$/, "")}`);
        expectedIds.add(docId);

        const mtime = await getFileMtimeMs(mdPath);
        if (mtime <= checkpoint) {
          skipped++;
          continue;
        }

        const body = await readTruncatedBody(mdPath);
        await indexer.add({
          id: docId,
          source: "usc",
          title_number: meta.title_number,
          title_name: meta.title_name,
          granularity: "section",
          identifier: `${meta.title_number} U.S.C. § ${section.number}`,
          heading: section.name,
          body,
          status: section.status,
          hierarchy: [`Title ${meta.title_number}`, `Chapter ${chapter.number}`, `§ ${section.number}`],
          url: `/usc/${titleDir}/${chapter.directory}/${section.file.replace(/\.md$/, "")}`,
        });
        indexed++;
      }
    }
  }

  return { indexed, skipped };
}

// --- eCFR — walk, diff, and upsert ---

async function indexEcfrIncremental(
  contentDir: string,
  indexer: BatchIndexer,
  checkpoint: number,
  expectedIds: Set<string>,
): Promise<{ indexed: number; skipped: number }> {
  const ecfrDir = join(contentDir, "ecfr", "sections");
  const titleDirs = (await listDirs(ecfrDir)).filter((d) => d.startsWith("title-"));
  let indexed = 0;
  let skipped = 0;

  for (const titleDir of titleDirs) {
    const titleMeta = await readJson<EcfrTitleMeta>(join(ecfrDir, titleDir, "_meta.json"));
    if (!titleMeta) continue;

    const chapterDirs = (await listDirs(join(ecfrDir, titleDir))).filter((d) => d.startsWith("chapter-"));

    for (const chapterDir of chapterDirs) {
      const chapterPath = join(ecfrDir, titleDir, chapterDir);
      const partDirs = (await listDirs(chapterPath)).filter((d) => d.startsWith("part-"));
      const chapterNumber = chapterDir.replace("chapter-", "");

      for (const partDir of partDirs) {
        const partMeta = await readJson<EcfrPartMeta>(join(chapterPath, partDir, "_meta.json"));
        if (!partMeta) continue;

        for (const section of partMeta.sections) {
          const mdPath = join(chapterPath, partDir, section.file);
          const docId = sanitizeId(`ecfr-${titleDir}-${section.file.replace(/\.md$/, "")}`);
          expectedIds.add(docId);

          const mtime = await getFileMtimeMs(mdPath);
          if (mtime <= checkpoint) {
            skipped++;
            continue;
          }

          const body = await readTruncatedBody(mdPath);
          await indexer.add({
            id: docId,
            source: "ecfr",
            title_number: titleMeta.title_number,
            title_name: titleMeta.title_name,
            granularity: "section",
            identifier: `${titleMeta.title_number} CFR § ${section.number}`,
            heading: section.name,
            body,
            status: section.status,
            hierarchy: [
              `Title ${titleMeta.title_number}`,
              `Chapter ${chapterNumber}`,
              `Part ${partMeta.part_number}`,
              `§ ${section.number}`,
            ],
            url: `/ecfr/${titleDir}/${chapterDir}/${partDir}/${section.file.replace(/\.md$/, "")}`,
          });
          indexed++;
        }
      }
    }
  }

  return { indexed, skipped };
}

// --- FR — walk, diff, and upsert (no _meta.json, reads frontmatter directly) ---

async function indexFrIncremental(
  contentDir: string,
  indexer: BatchIndexer,
  checkpoint: number,
  expectedIds: Set<string>,
): Promise<{ indexed: number; skipped: number }> {
  const frDir = join(contentDir, "fr", "documents");
  let yearDirs: string[];
  try {
    yearDirs = (await readdir(frDir)).filter((d) => /^\d{4}$/.test(d)).sort();
  } catch {
    return { indexed: 0, skipped: 0 };
  }

  let indexed = 0;
  let skipped = 0;

  for (const yearDir of yearDirs) {
    const yearPath = join(frDir, yearDir);
    let monthDirs: string[];
    try {
      monthDirs = (await readdir(yearPath)).filter((d) => /^\d{2}$/.test(d)).sort();
    } catch {
      continue;
    }

    for (const monthDir of monthDirs) {
      const monthPath = join(yearPath, monthDir);
      let files: string[];
      try {
        files = (await readdir(monthPath)).filter((f) => f.endsWith(".md") && f !== ".md");
      } catch {
        continue;
      }

      for (const file of files) {
        const mdPath = join(monthPath, file);
        const docId = sanitizeId(`fr-${yearDir}-${monthDir}-${file.replace(/\.md$/, "")}`);
        expectedIds.add(docId);

        const mtime = await getFileMtimeMs(mdPath);
        if (mtime <= checkpoint) {
          skipped++;
          continue;
        }

        try {
          const raw = await readFile(mdPath, "utf-8");
          // cache: false prevents unbounded memory growth in batch processing
          const { data, content } = matter(raw, { cache: false });

          const docNumber = (data.document_number as string) || file.replace(/\.md$/, "");
          const heading = (data.section_name as string) || (data.title as string) || docNumber;
          const docType = (data.document_type as string) || "";
          const pubDate = (data.publication_date as string) || "";
          const agencies = Array.isArray(data.agencies)
            ? (data.agencies as string[])
            : data.agency
              ? [data.agency as string]
              : [];

          const body = content
            .replace(/^#{1,6}\s+.*$/gm, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, BODY_TRUNCATE_CHARS);

          await indexer.add({
            id: docId,
            source: "fr",
            title_number: 0,
            title_name: "Federal Register",
            granularity: "document",
            identifier: (data.fr_citation as string) || `FR Doc. ${docNumber}`,
            heading,
            body,
            status: docType,
            document_type: docType,
            publication_date: pubDate || undefined,
            hierarchy: [
              yearDir,
              pubDate || `${yearDir}-${monthDir}`,
              ...(agencies.length > 0 ? [agencies[0] as string] : []),
            ],
            url: `/fr/${yearDir}/${monthDir}/${file.replace(/\.md$/, "")}`,
          });
          indexed++;
        } catch (err) {
          console.warn(`  Warning: skipping ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  return { indexed, skipped };
}

// --- Prune — remove orphaned documents from the index ---

async function pruneOrphans(client: Meilisearch, expectedIds: Set<string>): Promise<number> {
  console.log("\nPruning orphaned documents...");
  console.log(`  Expected documents on disk: ${expectedIds.size}`);

  const index = client.index(INDEX_NAME);
  const orphanIds: string[] = [];
  const pageSize = 1000;
  let offset = 0;
  let totalInIndex = 0;

  // Paginate through all document IDs in the index
  while (true) {
    const result = await index.getDocuments({ limit: pageSize, offset, fields: ["id"] });
    for (const doc of result.results) {
      totalInIndex++;
      const id = doc.id as string;
      if (!expectedIds.has(id)) {
        orphanIds.push(id);
      }
    }
    if (result.results.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`  Documents in index: ${totalInIndex}`);
  console.log(`  Orphaned documents: ${orphanIds.length}`);

  if (orphanIds.length > 0) {
    // Delete in batches of 1000
    for (let i = 0; i < orphanIds.length; i += 1000) {
      const batch = orphanIds.slice(i, i + 1000);
      const task = await index.deleteDocuments(batch);
      await client.tasks.waitForTask(task.taskUid, { timeout: 300_000 });
    }
    console.log(`  Deleted ${orphanIds.length} orphaned documents.`);
  } else {
    console.log("  No orphans found.");
  }

  return orphanIds.length;
}

// --- Index configuration (only for new indexes) ---

async function configureIndex(client: Meilisearch): Promise<void> {
  const index = client.index(INDEX_NAME);
  const wait = (task: { taskUid: number }) => client.tasks.waitForTask(task.taskUid);

  console.log("Configuring index settings...");

  await wait(await index.updateSearchableAttributes(["identifier", "heading", "body"]));
  await wait(
    await index.updateFilterableAttributes([
      "source",
      "title_number",
      "granularity",
      "status",
      "document_type",
      "publication_date",
    ]),
  );
  await wait(await index.updateSortableAttributes(["title_number", "identifier", "publication_date"]));
  await wait(
    await index.updateDisplayedAttributes([
      "id",
      "source",
      "title_number",
      "title_name",
      "identifier",
      "heading",
      "status",
      "hierarchy",
      "url",
      "document_type",
      "publication_date",
    ]),
  );
  await wait(await index.updateRankingRules(["words", "typo", "proximity", "attribute", "sort", "exactness"]));

  console.log("  Index settings configured.");
}

// --- Main ---

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let contentDir = "./content";
  let prune = false;
  let sourceFilter: "usc" | "ecfr" | "fr" | null = null;
  let setCheckpoint = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--set-checkpoint") {
      setCheckpoint = true;
    } else if (arg === "--prune") {
      prune = true;
    } else if (arg === "--source" && args[i + 1]) {
      const val = args[i + 1]!;
      if (val !== "usc" && val !== "ecfr" && val !== "fr") {
        console.error(`Invalid source: ${val}. Must be usc, ecfr, or fr.`);
        process.exit(1);
      }
      sourceFilter = val;
      i++;
    } else if (!arg.startsWith("--")) {
      contentDir = arg;
    }
  }

  const resolvedDir = resolve(contentDir);
  const runStartTime = Date.now();

  if (setCheckpoint) {
    const now = Date.now();
    const targets = sourceFilter ? [sourceFilter] : [...SOURCES];
    for (const src of targets) {
      await writeSourceCheckpoint(resolvedDir, src, now);
    }
    console.log(`Checkpoint set to ${new Date().toISOString()} for ${targets.join(", ")} in ${resolvedDir}`);
    return;
  }

  console.log(`Content directory: ${resolvedDir}`);
  console.log(`Meilisearch URL: ${MEILI_URL}`);
  console.log(`Index name: ${INDEX_NAME}`);
  console.log(`Mode: incremental upsert${prune ? " + prune" : ""}${sourceFilter ? ` (${sourceFilter} only)` : ""}`);
  console.log(`  Preserves the existing index. Adds new documents and updates existing ones.`);

  const client = new Meilisearch({
    host: MEILI_URL,
    apiKey: MEILI_MASTER_KEY,
  });

  try {
    const health = await client.health();
    console.log(`Meilisearch status: ${health.status}`);
  } catch (err) {
    console.error(`Cannot connect to Meilisearch at ${MEILI_URL}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Check if index exists; create and configure if not
  let indexExists = true;
  try {
    await client.index(INDEX_NAME).getStats();
  } catch {
    indexExists = false;
  }

  if (!indexExists) {
    console.log("  Index does not exist — creating and configuring...");
    const task = await client.createIndex(INDEX_NAME, { primaryKey: "id" });
    await client.tasks.waitForTask(task.taskUid);
    await configureIndex(client);
  }

  // Read per-source checkpoints
  const checkpoints: Record<string, number> = {};
  const activeSources = sourceFilter ? [sourceFilter] : [...SOURCES];
  for (const src of activeSources) {
    checkpoints[src] = await readSourceCheckpoint(resolvedDir, src);
  }

  for (const src of activeSources) {
    const cp = checkpoints[src]!;
    if (cp > 0) {
      console.log(`\n${src} checkpoint: ${new Date(cp).toISOString()}`);
    } else {
      console.log(`\n${src}: no checkpoint — will scan all files`);
    }
  }

  const indexer = new BatchIndexer(client, INDEX_NAME, BATCH_SIZE);

  // Track all expected IDs for pruning
  const expectedIds = new Set<string>();

  let totalIndexed = 0;
  let totalSkipped = 0;

  // Index USC
  if (!sourceFilter || sourceFilter === "usc") {
    console.log("\nScanning USC documents...");
    const usc = await indexUscIncremental(resolvedDir, indexer, checkpoints["usc"]!, expectedIds);
    await indexer.flush();
    console.log(`  USC: ${usc.indexed} upserted, ${usc.skipped} skipped (unchanged since checkpoint)`);
    totalIndexed += usc.indexed;
    totalSkipped += usc.skipped;
  }

  // Index eCFR
  if (!sourceFilter || sourceFilter === "ecfr") {
    console.log("\nScanning eCFR documents...");
    const ecfr = await indexEcfrIncremental(resolvedDir, indexer, checkpoints["ecfr"]!, expectedIds);
    await indexer.flush();
    console.log(`  eCFR: ${ecfr.indexed} upserted, ${ecfr.skipped} skipped (unchanged since checkpoint)`);
    totalIndexed += ecfr.indexed;
    totalSkipped += ecfr.skipped;
  }

  // Index FR
  if (!sourceFilter || sourceFilter === "fr") {
    console.log("\nScanning FR documents...");
    const fr = await indexFrIncremental(resolvedDir, indexer, checkpoints["fr"]!, expectedIds);
    await indexer.flush();
    console.log(`  FR: ${fr.indexed} upserted, ${fr.skipped} skipped (unchanged since checkpoint)`);
    totalIndexed += fr.indexed;
    totalSkipped += fr.skipped;
  }

  // Prune orphaned documents (only safe when all sources are scanned)
  let pruned = 0;
  if (prune && sourceFilter) {
    console.log("\n  --prune ignored: cannot prune when --source is set (would delete other sources)");
  } else if (prune) {
    pruned = await pruneOrphans(client, expectedIds);
  }

  // Update per-source checkpoints for every source that was indexed
  for (const src of activeSources) {
    await writeSourceCheckpoint(resolvedDir, src, runStartTime);
  }
  console.log(`\n  Checkpoint updated for ${activeSources.join(", ")}.`);

  // Summary
  const index = client.index(INDEX_NAME);
  const stats = await index.getStats();
  console.log(`\nDone in ${indexer.elapsed}s`);
  console.log(`  Upserted: ${totalIndexed} (added or updated in Meilisearch)`);
  console.log(`  Skipped: ${totalSkipped} (unchanged since last checkpoint)`);
  if (prune) console.log(`  Pruned: ${pruned} (removed from index — files no longer on disk)`);
  console.log(`  Total documents in index: ${stats.numberOfDocuments}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
