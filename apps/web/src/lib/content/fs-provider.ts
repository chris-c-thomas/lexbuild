import type { Dirent } from "node:fs";
import { readFile, readdir, access } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import type { ContentProvider, NavProvider } from "./types";
import type { ChapterNav, SectionNavEntry, TitleSummary } from "../types";

const CONTENT_ROOT = resolve(process.env.CONTENT_DIR ?? "./content");

/**
 * Validate that a resolved path stays within CONTENT_ROOT.
 * Prevents path traversal attacks via crafted URL segments.
 */
function safePath(subpath: string): string {
  const resolved = resolve(CONTENT_ROOT, subpath);
  const rel = relative(CONTENT_ROOT, resolved);
  if (rel.startsWith("..")) {
    throw new Error(`Path traversal blocked: ${subpath}`);
  }
  return resolved;
}

/** Filesystem-backed content provider. Reads .md files from local disk. */
export class FsContentProvider implements ContentProvider {
  async getFile(path: string): Promise<string | null> {
    try {
      return await readFile(safePath(path), "utf-8");
    } catch {
      return null;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(safePath(path));
      return true;
    } catch {
      return false;
    }
  }
}

/** Filesystem-backed navigation provider. Reads _meta.json sidecars from section-level output. */
export class FsNavProvider implements NavProvider {
  async getTitles(): Promise<TitleSummary[]> {
    const uscDir = join(CONTENT_ROOT, "section", "usc");
    let entries: Dirent[];
    try {
      entries = await readdir(uscDir, { withFileTypes: true });
    } catch {
      // Content not yet generated — return empty list instead of crashing
      return [];
    }
    const titleDirs = entries
      .filter((e: Dirent) => e.isDirectory() && e.name.startsWith("title-"))
      .sort((a: Dirent, b: Dirent) => a.name.localeCompare(b.name));

    const titles: TitleSummary[] = [];
    for (const dir of titleDirs) {
      try {
        const raw = await readFile(join(uscDir, dir.name, "_meta.json"), "utf-8");
        const meta = JSON.parse(raw) as Record<string, unknown>;
        const stats = meta.stats as Record<string, unknown> | undefined;
        titles.push({
          number: meta.title_number as number,
          name: meta.title_name as string,
          directory: dir.name,
          positiveLaw: (meta.positive_law as boolean) ?? false,
          chapterCount: (stats?.chapter_count as number) ?? 0,
          sectionCount: (stats?.section_count as number) ?? 0,
          tokenEstimate: (stats?.total_tokens_estimate as number) ?? 0,
        });
      } catch {
        // Skip titles with missing or malformed _meta.json
      }
    }
    return titles;
  }

  async getChapters(titleDir: string): Promise<ChapterNav[]> {
    try {
      const metaPath = safePath(join("section", "usc", titleDir, "_meta.json"));
      const raw = await readFile(metaPath, "utf-8");
      const meta = JSON.parse(raw) as Record<string, unknown>;
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
