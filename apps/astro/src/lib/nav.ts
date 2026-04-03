/**
 * Navigation data reader — loads pre-built sidebar JSON for title/chapter/part index pages.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SourceId, TitleSummary, ChapterNav, FrYearSummary, FrDocumentNav } from "./types";

const NAV_DIR = resolve(process.env.NAV_DIR ?? "./public/nav");

interface TitleNavData {
  chapters: ChapterNav[];
}

/** Load all title summaries for a source. */
export async function getTitles(sourceId: SourceId): Promise<TitleSummary[]> {
  try {
    const raw = await readFile(resolve(NAV_DIR, `${sourceId}/titles.json`), "utf-8");
    return JSON.parse(raw) as TitleSummary[];
  } catch {
    return [];
  }
}

/** Load a single title summary by directory name. */
export async function getTitleSummary(sourceId: SourceId, titleDir: string): Promise<TitleSummary | null> {
  const titles = await getTitles(sourceId);
  return titles.find((t) => t.directory === titleDir) ?? null;
}

/** Load the nav data for a specific title (chapters, parts, sections). */
export async function getTitleNav(sourceId: SourceId, titleDir: string): Promise<TitleNavData | null> {
  try {
    const raw = await readFile(resolve(NAV_DIR, `${sourceId}/${titleDir}.json`), "utf-8");
    return JSON.parse(raw) as TitleNavData;
  } catch {
    return null;
  }
}

/** Find a specific chapter within a title's nav data. */
export async function getChapterNav(
  sourceId: SourceId,
  titleDir: string,
  chapterDir: string,
): Promise<ChapterNav | null> {
  const titleNav = await getTitleNav(sourceId, titleDir);
  if (!titleNav) return null;
  return titleNav.chapters.find((ch) => ch.directory === chapterDir) ?? null;
}

// ── FR navigation ──

/** Load FR year summaries for the archive index. */
export async function getFrYears(): Promise<FrYearSummary[]> {
  try {
    const raw = await readFile(resolve(NAV_DIR, "fr/years.json"), "utf-8");
    return JSON.parse(raw) as FrYearSummary[];
  } catch {
    return [];
  }
}

/** Load a single FR year summary. */
export async function getFrYear(year: number): Promise<FrYearSummary | null> {
  const years = await getFrYears();
  return years.find((y) => y.year === year) ?? null;
}

/** Load FR documents for a specific month. */
export async function getFrMonthDocuments(year: number, month: number): Promise<FrDocumentNav[]> {
  try {
    const monthStr = String(month).padStart(2, "0");
    const raw = await readFile(resolve(NAV_DIR, `fr/${year}-${monthStr}.json`), "utf-8");
    return JSON.parse(raw) as FrDocumentNav[];
  } catch {
    return [];
  }
}
