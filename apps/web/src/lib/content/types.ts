import type { ChapterNav, SectionNavEntry, TitleSummary } from "../types";

/** Reads content files (Markdown) from the storage backend. */
export interface ContentProvider {
  /** Read a file by path (e.g., "section/usc/title-01/chapter-01/section-1.md") */
  getFile(path: string): Promise<string | null>;
  /** Check if a file exists */
  exists(path: string): Promise<boolean>;
}

/** Reads navigation data from _meta.json sidecars. */
export interface NavProvider {
  /** Get the top-level titles list */
  getTitles(): Promise<TitleSummary[]>;
  /** Get chapters for a title */
  getChapters(titleDir: string): Promise<ChapterNav[]>;
  /** Get sections for a chapter */
  getSections(titleDir: string, chapterDir: string): Promise<SectionNavEntry[]>;
}
