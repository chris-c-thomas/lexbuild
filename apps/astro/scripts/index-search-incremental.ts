/**
 * Incremental search index update for Meilisearch.
 *
 * Only indexes documents whose .md files have been modified since the last
 * successful run (mtime-based). Stores a checkpoint timestamp in
 * `<content-dir>/.search-indexed-at`. On first run (no checkpoint), indexes
 * everything without deleting the existing index.
 *
 * Use `index-search.ts` for a full clean reindex (delete + rebuild).
 *
 * Usage:
 *   npx tsx scripts/index-search-incremental.ts [content-dir] [--prune]
 *
 * Options:
 *   content-dir   Path to content directory (default: ./content)
 *   --prune       Remove documents from the index for sections that no longer
 *                 exist on disk (compares Meilisearch IDs against filesystem)
 *
 * Environment:
 *   MEILI_URL          Meilisearch endpoint (default: http://127.0.0.1:7700)
 *   MEILI_MASTER_KEY   Master key for admin operations (default: none for dev)
 */

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Meilisearch } from "meilisearch";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MEILI_URL = process.env.MEILI_URL ?? "http://127.0.0.1:7700";
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY ?? "";
const INDEX_NAME = "lexbuild";
const BATCH_SIZE = 500;
const BODY_TRUNCATE_CHARS = 5000;
const CHECKPOINT_FILE = ".search-indexed-at";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchDocument {
  id: string;
  source: "usc" | "ecfr";
  title_number: number;
  title_name: string;
  granularity: string;
  identifier: string;
  heading: string;
  body: string;
  status: string;
  hierarchy: string[];
  url: string;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    const { content } = matter(raw);
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

// ---------------------------------------------------------------------------
// Checkpoint
// ---------------------------------------------------------------------------

async function readCheckpoint(contentDir: string): Promise<number> {
  try {
    const raw = await readFile(join(contentDir, CHECKPOINT_FILE), "utf-8");
    return parseInt(raw.trim(), 10);
  } catch {
    return 0;
  }
}

async function writeCheckpoint(contentDir: string, timestamp: number): Promise<void> {
  await writeFile(join(contentDir, CHECKPOINT_FILE), String(timestamp), "utf-8");
}

// ---------------------------------------------------------------------------
// Batch sender
// ---------------------------------------------------------------------------

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

    const index = this.client.index(this.indexName);
    const task = await index.addDocuments(this.batch);
    await this.client.tasks.waitForTask(task.taskUid, { timeout: 60_000 });

    this.totalSent += this.batch.length;
    this.batchesSent++;
    this.batch = [];

    if (this.batchesSent % 10 === 0) {
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

// ---------------------------------------------------------------------------
// USC — walk, diff, and upsert
// ---------------------------------------------------------------------------

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
          hierarchy: [
            `Title ${meta.title_number}`,
            `Chapter ${chapter.number}`,
            `§ ${section.number}`,
          ],
          url: `/usc/${titleDir}/${chapter.directory}/${section.file.replace(/\.md$/, "")}`,
        });
        indexed++;
      }
    }
  }

  return { indexed, skipped };
}

// ---------------------------------------------------------------------------
// eCFR — walk, diff, and upsert
// ---------------------------------------------------------------------------

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

    const chapterDirs = (await listDirs(join(ecfrDir, titleDir))).filter((d) =>
      d.startsWith("chapter-"),
    );

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

// ---------------------------------------------------------------------------
// Prune — remove orphaned documents from the index
// ---------------------------------------------------------------------------

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
      await client.tasks.waitForTask(task.taskUid, { timeout: 60_000 });
    }
    console.log(`  Deleted ${orphanIds.length} orphaned documents.`);
  } else {
    console.log("  No orphans found.");
  }

  return orphanIds.length;
}

// ---------------------------------------------------------------------------
// Index configuration (only for new indexes)
// ---------------------------------------------------------------------------

async function configureIndex(client: Meilisearch): Promise<void> {
  const index = client.index(INDEX_NAME);
  const wait = (task: { taskUid: number }) => client.tasks.waitForTask(task.taskUid);

  console.log("Configuring index settings...");

  await wait(await index.updateSearchableAttributes(["identifier", "heading", "body"]));
  await wait(
    await index.updateFilterableAttributes(["source", "title_number", "granularity", "status"]),
  );
  await wait(await index.updateSortableAttributes(["title_number", "identifier"]));
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
    ]),
  );
  await wait(
    await index.updateRankingRules([
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ]),
  );

  console.log("  Index settings configured.");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let contentDir = "./content";
  let prune = false;

  for (const arg of args) {
    if (arg === "--prune") {
      prune = true;
    } else if (!arg.startsWith("--")) {
      contentDir = arg;
    }
  }

  const resolvedDir = resolve(contentDir);
  const runStartTime = Date.now();

  console.log(`Content directory: ${resolvedDir}`);
  console.log(`Meilisearch URL: ${MEILI_URL}`);
  console.log(`Index name: ${INDEX_NAME}`);
  console.log(`Mode: incremental${prune ? " + prune" : ""}`);

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

  // Read checkpoint
  const checkpoint = await readCheckpoint(resolvedDir);
  if (checkpoint > 0) {
    const checkpointDate = new Date(checkpoint).toISOString();
    console.log(`\nCheckpoint: ${checkpointDate}`);
    console.log("  Indexing files modified after this timestamp.");
  } else {
    console.log("\nNo checkpoint found — indexing all files.");
  }

  const indexer = new BatchIndexer(client, INDEX_NAME, BATCH_SIZE);

  // Track all expected IDs for pruning
  const expectedIds = new Set<string>();

  // Index USC
  console.log("\nScanning USC documents...");
  const usc = await indexUscIncremental(resolvedDir, indexer, checkpoint, expectedIds);
  await indexer.flush();
  console.log(`  USC: ${usc.indexed} indexed, ${usc.skipped} unchanged`);

  // Index eCFR
  console.log("\nScanning eCFR documents...");
  const ecfr = await indexEcfrIncremental(resolvedDir, indexer, checkpoint, expectedIds);
  await indexer.flush();
  console.log(`  eCFR: ${ecfr.indexed} indexed, ${ecfr.skipped} unchanged`);

  const totalIndexed = usc.indexed + ecfr.indexed;
  const totalSkipped = usc.skipped + ecfr.skipped;

  // Prune orphaned documents
  let pruned = 0;
  if (prune) {
    pruned = await pruneOrphans(client, expectedIds);
  }

  // Update checkpoint to the start of this run
  await writeCheckpoint(resolvedDir, runStartTime);

  // Summary
  const index = client.index(INDEX_NAME);
  const stats = await index.getStats();
  console.log(`\nDone in ${indexer.elapsed}s`);
  console.log(`  Indexed: ${totalIndexed}`);
  console.log(`  Unchanged: ${totalSkipped}`);
  if (prune) console.log(`  Pruned: ${pruned}`);
  console.log(`  Total documents in index: ${stats.numberOfDocuments}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
