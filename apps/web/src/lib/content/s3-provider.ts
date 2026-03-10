import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { ContentProvider, NavProvider } from "./types";
import type { ChapterNav, SectionNavEntry, TitleSummary } from "../types";

function getS3Client(): S3Client {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const region = process.env.R2_REGION ?? "auto";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 configuration. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

/** Lazily read R2_BUCKET to avoid module-load side effects. */
function bucket(): string {
  return process.env.R2_BUCKET ?? "lexbuild-content";
}

/**
 * Validate that an S3 key stays within expected content prefixes.
 * Prevents path traversal via crafted URL segments (e.g., "../secrets").
 */
function safeKey(key: string): string {
  const ALLOWED_PREFIXES = ["section/", "chapter/", "title/"];
  const normalized = key.replace(/\/+/g, "/");
  if (
    normalized.includes("..") ||
    !ALLOWED_PREFIXES.some((p) => normalized.startsWith(p))
  ) {
    throw new Error(`Invalid content key: ${key}`);
  }
  return normalized;
}

let _client: S3Client | null = null;

/** Returns a cached S3 client singleton. */
function client(): S3Client {
  if (!_client) {
    _client = getS3Client();
  }
  return _client;
}

/**
 * Read an object from S3/R2 as a UTF-8 string.
 * Returns null if the key does not exist.
 */
async function getObject(key: string): Promise<string | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return (await res.Body?.transformToString("utf-8")) ?? null;
  } catch (err: unknown) {
    if (isNoSuchKey(err)) return null;
    throw err;
  }
}

function isNoSuchKey(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: string }).name;
  return name === "NoSuchKey" || name === "NotFound";
}

/** S3/R2-backed content provider. Reads .md files from an S3-compatible bucket. */
export class S3ContentProvider implements ContentProvider {
  async getFile(path: string): Promise<string | null> {
    try {
      return await getObject(safeKey(path));
    } catch {
      return null;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: safeKey(path) }));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Module-level cache for parsed _meta.json files.
 * Persists across requests within the same serverless function instance.
 * Content updates in R2 are NOT reflected until the function instance is recycled
 * (i.e., on the next cold start or redeployment).
 */
const metaCache = new Map<string, Record<string, unknown>>();

/** Fetch and cache a _meta.json file from S3. */
async function getMeta(key: string): Promise<Record<string, unknown> | null> {
  const cached = metaCache.get(key);
  if (cached) return cached;

  const raw = await getObject(key);
  if (!raw) return null;

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  metaCache.set(key, parsed);
  return parsed;
}

/** Cached title directory listing. Same lifetime as metaCache. */
let titleDirsCache: string[] | null = null;

/** List and cache title directories from S3. */
async function listTitleDirs(): Promise<string[]> {
  if (titleDirsCache) return titleDirsCache;

  const prefix = "section/usc/";
  const dirs: string[] = [];

  let continuationToken: string | undefined;
  do {
    const res = await client().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        Delimiter: "/",
        ContinuationToken: continuationToken,
      }),
    );
    for (const cp of res.CommonPrefixes ?? []) {
      if (cp.Prefix) {
        const dir = cp.Prefix.slice(prefix.length).replace(/\/$/, "");
        if (dir.startsWith("title-")) {
          dirs.push(dir);
        }
      }
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  dirs.sort((a, b) => a.localeCompare(b));
  titleDirsCache = dirs;
  return dirs;
}

/** S3/R2-backed navigation provider. Reads _meta.json sidecars from the bucket. */
export class S3NavProvider implements NavProvider {
  async getTitles(): Promise<TitleSummary[]> {
    const titleDirs = await listTitleDirs();

    // Fetch all title metadata in parallel to minimize cold-start latency
    const titleEntries = await Promise.all(
      titleDirs.map(async (dir) => {
        try {
          const meta = await getMeta(safeKey(`section/usc/${dir}/_meta.json`));
          if (!meta) return null;
          const stats = meta.stats as Record<string, unknown> | undefined;
          return {
            number: meta.title_number as number,
            name: meta.title_name as string,
            directory: dir,
            positiveLaw: (meta.positive_law as boolean) ?? false,
            chapterCount: (stats?.chapter_count as number) ?? 0,
            sectionCount: (stats?.section_count as number) ?? 0,
            tokenEstimate: (stats?.total_tokens_estimate as number) ?? 0,
          } satisfies TitleSummary;
        } catch {
          return null;
        }
      }),
    );
    const titles: TitleSummary[] = titleEntries.filter(
      (t): t is TitleSummary => t !== null,
    );

    // Inject Title 53 (Reserved) if not present
    if (!titles.some((t) => t.number === 53)) {
      titles.push({
        number: 53,
        name: "RESERVED",
        directory: "title-53",
        positiveLaw: false,
        chapterCount: 0,
        sectionCount: 0,
        tokenEstimate: 0,
      });
      titles.sort((a, b) => a.number - b.number);
    }

    return titles;
  }

  async getChapters(titleDir: string): Promise<ChapterNav[]> {
    try {
      const meta = await getMeta(safeKey(`section/usc/${titleDir}/_meta.json`));
      if (!meta) return [];

      const chapters = meta.chapters as Record<string, unknown>[] | undefined;
      return (chapters ?? []).map((ch) => ({
        number: ch.number as number,
        name: ch.name as string,
        directory: ch.directory as string,
        sections: ((ch.sections as Record<string, unknown>[] | undefined) ?? []).map((s) => ({
          number: s.number as string,
          name: s.name as string,
          file: (s.file as string).replace(/\.md$/, ""),
          status: (s.status as string) ?? "current",
          hasNotes: (s.has_notes as boolean) ?? false,
        })),
      }));
    } catch {
      return [];
    }
  }

  async getSections(titleDir: string, chapterDir: string): Promise<SectionNavEntry[]> {
    const chapters = await this.getChapters(titleDir);
    const chapter = chapters.find((ch) => ch.directory === chapterDir);
    return chapter?.sections ?? [];
  }
}
