import { get, head, list } from "@vercel/blob";
import type { ContentProvider, NavProvider } from "./types";
import type { ChapterNav, SectionNavEntry, TitleSummary } from "../types";

/**
 * Validate that a blob pathname stays within expected content prefixes.
 * Prevents path traversal via crafted URL segments.
 */
function safePath(pathname: string): string {
  const ALLOWED_PREFIXES = ["section/", "chapter/", "title/"];
  const normalized = pathname.replace(/\/+/g, "/");
  if (normalized.includes("..") || !ALLOWED_PREFIXES.some((p) => normalized.startsWith(p))) {
    throw new Error(`Invalid content path: ${pathname}`);
  }
  return normalized;
}

/**
 * Read a blob as a UTF-8 string by pathname.
 * Returns null if the blob does not exist.
 */
async function getBlob(pathname: string): Promise<string | null> {
  try {
    const result = await get(pathname, { access: "public" });
    if (!result) return null;
    const response = new Response(result.stream);
    return await response.text();
  } catch (err: unknown) {
    if (isBlobNotFound(err)) return null;
    throw err;
  }
}

function isBlobNotFound(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: string }).name;
  const code = (err as { code?: string }).code;
  return name === "BlobNotFoundError" || code === "blob_not_found";
}

/** Vercel Blob-backed content provider. Reads .md files from a Vercel Blob store. */
export class BlobContentProvider implements ContentProvider {
  async getFile(path: string): Promise<string | null> {
    try {
      return await getBlob(safePath(path));
    } catch {
      return null;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await head(safePath(path));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Module-level cache for parsed _meta.json files.
 * Persists across requests within the same serverless function instance.
 */
const metaCache = new Map<string, Record<string, unknown>>();

/** Fetch and cache a _meta.json file from Blob storage. */
async function getMeta(pathname: string): Promise<Record<string, unknown> | null> {
  const cached = metaCache.get(pathname);
  if (cached) return cached;

  const raw = await getBlob(pathname);
  if (!raw) return null;

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  metaCache.set(pathname, parsed);
  return parsed;
}

/** Cached title directory listing. Same lifetime as metaCache. */
let titleDirsCache: string[] | null = null;

/** List and cache title directories from Blob storage. */
async function listTitleDirs(): Promise<string[]> {
  if (titleDirsCache) return titleDirsCache;

  const prefix = "section/usc/";
  const dirs: string[] = [];

  let cursor: string | undefined;
  do {
    const result = await list({
      prefix,
      mode: "folded",
      limit: 1000,
      cursor,
    });
    for (const folder of result.folders) {
      const dir = folder.slice(prefix.length).replace(/\/$/, "");
      if (dir.startsWith("title-")) {
        dirs.push(dir);
      }
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  dirs.sort((a, b) => a.localeCompare(b));
  titleDirsCache = dirs;
  return dirs;
}

/** Vercel Blob-backed navigation provider. Reads _meta.json sidecars from the store. */
export class BlobNavProvider implements NavProvider {
  async getTitles(): Promise<TitleSummary[]> {
    const titleDirs = await listTitleDirs();

    const titleEntries = await Promise.all(
      titleDirs.map(async (dir) => {
        try {
          const meta = await getMeta(safePath(`section/usc/${dir}/_meta.json`));
          if (!meta) return null;
          const stats = meta.stats as Record<string, unknown> | undefined;
          const summary: TitleSummary = {
            number: meta.title_number as number,
            name: meta.title_name as string,
            directory: dir,
            positiveLaw: (meta.positive_law as boolean) ?? false,
            chapterCount: (stats?.chapter_count as number) ?? 0,
            sectionCount: (stats?.section_count as number) ?? 0,
            tokenEstimate: (stats?.total_tokens_estimate as number) ?? 0,
          };
          if (typeof meta.release_point === "string") {
            summary.releasePoint = meta.release_point;
          }
          return summary;
        } catch {
          return null;
        }
      }),
    );
    const titles: TitleSummary[] = titleEntries.filter((t): t is TitleSummary => t !== null);

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
      const meta = await getMeta(safePath(`section/usc/${titleDir}/_meta.json`));
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
