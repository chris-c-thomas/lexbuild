import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import type { ContentProvider, NavProvider } from "./types";
import type { ChapterNav, SectionNavEntry, TitleSummary } from "../types";

const CONTENT_ROOT = process.env.CONTENT_DIR ?? "./content";

/** Filesystem-backed content provider. Reads .md files from local disk. */
export class FsContentProvider implements ContentProvider {
  async getFile(path: string): Promise<string | null> {
    try {
      return await readFile(join(CONTENT_ROOT, path), "utf-8");
    } catch {
      return null;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(join(CONTENT_ROOT, path));
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
    const entries = await readdir(uscDir, { withFileTypes: true });
    const titleDirs = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("title-"))
      .sort((a, b) => a.name.localeCompare(b.name));

    const titles: TitleSummary[] = [];
    for (const dir of titleDirs) {
      const raw = await readFile(join(uscDir, dir.name, "_meta.json"), "utf-8");
      const meta = JSON.parse(raw) as Record<string, unknown>;
      const stats = meta.stats as Record<string, unknown> | undefined;
      titles.push({
        number: meta.title_number as number,
        name: meta.title_name as string,
        directory: dir.name,
        chapterCount: (stats?.chapter_count as number) ?? 0,
        sectionCount: (stats?.section_count as number) ?? 0,
        tokenEstimate: (stats?.total_tokens_estimate as number) ?? 0,
      });
    }
    return titles;
  }

  async getChapters(titleDir: string): Promise<ChapterNav[]> {
    const metaPath = join(CONTENT_ROOT, "section", "usc", titleDir, "_meta.json");
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
  }

  async getSections(titleDir: string, chapterDir: string): Promise<SectionNavEntry[]> {
    const chapters = await this.getChapters(titleDir);
    const chapter = chapters.find((ch) => ch.directory === chapterDir);
    return chapter?.sections ?? [];
  }
}
