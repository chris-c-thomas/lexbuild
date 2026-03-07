import type { TitleSummary, TitleNav } from "./types";

/**
 * Fetch the titles summary list from static JSON.
 * Used client-side by the sidebar on initial load.
 */
export async function fetchTitles(): Promise<TitleSummary[]> {
  const res = await fetch("/nav/titles.json");
  if (!res.ok) return [];
  return res.json() as Promise<TitleSummary[]>;
}

/**
 * Fetch per-title navigation (chapters + sections) from static JSON.
 * Used client-side by the sidebar when expanding a title.
 */
export async function fetchTitleNav(titleDir: string): Promise<TitleNav | null> {
  const res = await fetch(`/nav/${titleDir}.json`);
  if (!res.ok) return null;
  return res.json() as Promise<TitleNav>;
}

/** Parse the current pathname into route segments for breadcrumbs and active state. */
export function parseUscPath(pathname: string): {
  titleDir?: string;
  chapterDir?: string;
  sectionSlug?: string;
} {
  // /usc/title-01/chapter-01/section-1/ → ["usc", "title-01", "chapter-01", "section-1"]
  const segments = pathname.split("/").filter(Boolean);
  return {
    titleDir: segments[1],
    chapterDir: segments[2],
    sectionSlug: segments[3],
  };
}
