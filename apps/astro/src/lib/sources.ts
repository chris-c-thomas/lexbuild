import type { SourceConfig, SourceId } from "./types";

export const SOURCES: Record<SourceId, SourceConfig> = {
  usc: {
    id: "usc",
    name: "United States Code",
    shortName: "USC",
    description: "General and permanent federal statutes, codified by subject matter into 54 titles.",
    basePath: "/usc",
    granularities: ["section", "chapter", "title"],
    hierarchy: ["title", "chapter", "section"],
    titleCount: 54,
    chapterCount: 2883,
    sectionCount: 60215,
    hasSidebar: true,
    slugGranularity: { 1: "title", 2: "chapter", 3: "section" },
  },
  ecfr: {
    id: "ecfr",
    name: "Code of Federal Regulations",
    shortName: "eCFR",
    description: "Federal agency regulations, codified by subject matter into 50 titles.",
    basePath: "/ecfr",
    granularities: ["section", "part", "chapter", "title"],
    hierarchy: ["title", "chapter", "part", "section"],
    titleCount: 50,
    chapterCount: 453,
    sectionCount: 227479,
    partCount: 8305,
    hasSidebar: true,
    slugGranularity: { 1: "title", 2: "chapter", 3: "part", 4: "section" },
  },
  fr: {
    id: "fr",
    name: "Federal Register",
    shortName: "FR",
    description:
      "Daily federal rules, proposed rules, notices, and presidential documents.",
    basePath: "/fr",
    granularities: ["document"],
    hierarchy: ["year", "month", "document"],
    titleCount: 0,
    chapterCount: 0,
    sectionCount: 0,
    hasSidebar: true,
    slugGranularity: { 1: "year", 2: "month", 3: "document" },
  },
};

/** Get source config by id. Throws if unknown. */
export function getSource(id: SourceId): SourceConfig {
  const source = SOURCES[id];
  if (!source) throw new Error(`Unknown source: ${id}`);
  return source;
}
