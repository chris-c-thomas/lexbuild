/**
 * Index content into Meilisearch for full-text search.
 *
 * Full clean reindex: deletes the existing index and rebuilds from scratch.
 * Indexes all three sources: USC, eCFR, and FR.
 *
 * IMPORTANT: Keep sources, SearchDocument shape, and index configuration in
 * sync with `index-search-incremental.ts` (the incremental upsert script).
 *
 * Usage: npx tsx scripts/index-search.ts [content-dir]
 *
 * Environment:
 *   MEILI_URL          Meilisearch endpoint (default: http://127.0.0.1:7700)
 *   MEILI_MASTER_KEY   Master key for admin operations (default: none for dev)
 */

import { readdir, readFile } from "node:fs/promises";
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
const GC_INTERVAL = 50_000; // Force GC every N files to prevent heap exhaustion

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

/**
 * Sanitize a document ID for Meilisearch.
 * Meilisearch only allows alphanumeric, hyphens, and underscores.
 */
function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** Read a .md file, strip frontmatter, truncate body. */
async function readTruncatedBody(mdPath: string): Promise<string> {
  try {
    const raw = await readFile(mdPath, "utf-8");
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

/** Track files processed and force GC at intervals to prevent heap exhaustion. */
let filesProcessed = 0;
function trackFileAndGC(): void {
  filesProcessed++;
  if (filesProcessed % GC_INTERVAL === 0) {
    const mem = (process.memoryUsage.rss() / 1024 / 1024).toFixed(0);
    console.log(
      `  [GC] ${filesProcessed} files processed, ${mem}MB RSS — forcing garbage collection`,
    );
    if (global.gc) {
      global.gc();
      const memAfter = (process.memoryUsage.rss() / 1024 / 1024).toFixed(0);
      console.log(`  [GC] After collection: ${memAfter}MB RSS`);
    }
  }
}

// ---------------------------------------------------------------------------
// Batch sender — flushes when batch is full
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
    await this.client.tasks.waitForTask(task.taskUid, { timeout: 300_000 });

    this.totalSent += this.batch.length;
    this.batchesSent++;
    this.batch = []; // Release memory

    if (this.batchesSent % 5 === 0) {
      const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(1);
      const mem = (process.memoryUsage.rss() / 1024 / 1024).toFixed(0);
      console.log(`  ${this.totalSent} docs sent (${elapsed}s, ${mem}MB RSS)`);
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
// USC indexing (streaming)
// ---------------------------------------------------------------------------

async function indexUscDocuments(contentDir: string, indexer: BatchIndexer): Promise<number> {
  const uscDir = join(contentDir, "usc", "sections");
  const titleDirs = (await listDirs(uscDir)).filter((d) => d.startsWith("title-"));
  let count = 0;

  for (const titleDir of titleDirs) {
    const meta = await readJson<UscTitleMeta>(join(uscDir, titleDir, "_meta.json"));
    if (!meta) continue;

    for (const chapter of meta.chapters) {
      for (const section of chapter.sections) {
        const mdPath = join(uscDir, titleDir, chapter.directory, section.file);
        const body = await readTruncatedBody(mdPath);

        await indexer.add({
          id: sanitizeId(`usc-${titleDir}-${section.file.replace(/\.md$/, "")}`),
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
        count++;
        trackFileAndGC();
      }
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// eCFR indexing (streaming)
// ---------------------------------------------------------------------------

async function indexEcfrDocuments(contentDir: string, indexer: BatchIndexer): Promise<number> {
  const ecfrDir = join(contentDir, "ecfr", "sections");
  const titleDirs = (await listDirs(ecfrDir)).filter((d) => d.startsWith("title-"));
  let count = 0;

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
          const body = await readTruncatedBody(mdPath);

          await indexer.add({
            id: sanitizeId(`ecfr-${titleDir}-${section.file.replace(/\.md$/, "")}`),
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
          count++;
          trackFileAndGC();
        }
      }
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// FR indexing (streaming — no _meta.json, reads frontmatter directly)
// ---------------------------------------------------------------------------

async function indexFrDocuments(contentDir: string, indexer: BatchIndexer): Promise<number> {
  const frDir = join(contentDir, "fr", "documents");
  let yearDirs: string[];
  try {
    yearDirs = (await readdir(frDir)).filter((d) => /^\d{4}$/.test(d)).sort();
  } catch {
    return 0;
  }

  let count = 0;

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
        try {
          const raw = await readFile(mdPath, "utf-8");
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
            id: sanitizeId(`fr-${yearDir}-${monthDir}-${file.replace(/\.md$/, "")}`),
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
          count++;
          trackFileAndGC();
        } catch (err) {
          console.warn(`  Warning: skipping ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Meilisearch index configuration
// ---------------------------------------------------------------------------

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
  const contentDir = resolve(process.argv[2] ?? "./content");

  console.log(`Content directory: ${contentDir}`);
  console.log(`Meilisearch URL: ${MEILI_URL}`);
  console.log(`Index name: ${INDEX_NAME}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Mode: full reindex (deletes existing index, rebuilds from scratch)`);

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

  // Delete existing index for clean reindex
  try {
    const task = await client.deleteIndex(INDEX_NAME);
    await client.tasks.waitForTask(task.taskUid);
    console.log("  Deleted existing index.");
  } catch {
    console.log("  No existing index to delete.");
  }

  await configureIndex(client);

  const indexer = new BatchIndexer(client, INDEX_NAME, BATCH_SIZE);

  console.log("\nIndexing USC documents...");
  console.log("  Reading .md files, extracting frontmatter, sending to Meilisearch in batches...");
  const uscCount = await indexUscDocuments(contentDir, indexer);
  await indexer.flush();
  console.log(`  ${uscCount} USC documents indexed`);

  console.log("\nIndexing eCFR documents...");
  console.log("  Reading .md files, extracting frontmatter, sending to Meilisearch in batches...");
  const ecfrCount = await indexEcfrDocuments(contentDir, indexer);
  await indexer.flush();
  console.log(`  ${ecfrCount} eCFR documents indexed`);

  console.log("\nIndexing FR documents...");
  console.log("  Reading .md files, extracting frontmatter, sending to Meilisearch in batches...");
  const frCount = await indexFrDocuments(contentDir, indexer);
  await indexer.flush();
  console.log(`  ${frCount} FR documents indexed`);

  // Verify
  const index = client.index(INDEX_NAME);
  const stats = await index.getStats();
  console.log(`\nDone in ${indexer.elapsed}s`);
  console.log(`  Total documents indexed: ${stats.numberOfDocuments}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
