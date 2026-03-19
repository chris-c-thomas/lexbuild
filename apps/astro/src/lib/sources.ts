import type { SourceConfig, SourceId } from "./types";

export const SOURCES: Record<SourceId, SourceConfig> = {
  usc: {
    id: "usc",
    name: "U.S. Code",
    shortName: "USC",
    description: "The codified general and permanent federal statutes of the United States.",
    basePath: "/usc",
    granularities: ["section", "chapter", "title"],
    hierarchy: ["title", "chapter", "section"],
    titleCount: 54,
    chapterCount: 2883,
    sectionCount: 60215,
    slugGranularity: { 1: "title", 2: "chapter", 3: "section" },
  },
  ecfr: {
    id: "ecfr",
    name: "Code of Federal Regulations",
    shortName: "eCFR",
    description: "The codified regulations of the federal executive departments and agencies.",
    basePath: "/ecfr",
    granularities: ["section", "part", "chapter", "title"],
    hierarchy: ["title", "chapter", "part", "section"],
    titleCount: 50,
    chapterCount: 453,
    sectionCount: 227479,
    partCount: 8305,
    slugGranularity: { 1: "title", 2: "chapter", 3: "part", 4: "section" },
  },
};

/** Get source config by id. Throws if unknown. */
export function getSource(id: SourceId): SourceConfig {
  const source = SOURCES[id];
  if (!source) throw new Error(`Unknown source: ${id}`);
  return source;
}
