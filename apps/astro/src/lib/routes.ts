import type { SourceId, Granularity, ResolvedRoute, Breadcrumb } from "./types";
import { getSource } from "./sources";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Resolve a source + slug array into a content path and metadata.
 * Returns null if the slug doesn't match expected patterns.
 *
 * USC:
 *   1 segment  → title     (title-NN)
 *   2 segments → chapter   (title-NN/chapter-NN)
 *   3 segments → section   (title-NN/chapter-NN/section-N)
 *
 * eCFR:
 *   1 segment  → title     (title-NN)
 *   2 segments → chapter   (title-NN/chapter-X)
 *   3 segments → part      (title-NN/chapter-X/part-N)
 *   4 segments → section   (title-NN/chapter-X/part-N/section-N.N)
 *
 * FR:
 *   1 segment  → year      (YYYY)
 *   2 segments → month     (YYYY/MM)
 *   3 segments → document  (YYYY/MM/document-number)
 */
export function resolveRoute(sourceId: SourceId, slug: string[] | undefined): ResolvedRoute | null {
  if (!slug || slug.length === 0) return null;

  const source = getSource(sourceId);
  const granularity = source.slugGranularity[slug.length];
  if (!granularity) return null;

  // Validate each segment
  for (const [i, segment] of slug.entries()) {
    if (!isValidSegment(segment, sourceId, i)) return null;
  }

  const segments = parseSegments(slug, sourceId);
  const contentPath = buildContentPath(sourceId, granularity, slug);
  const highlightPath = contentPath.replace(/\.md$/, ".highlighted.html");
  const breadcrumbs = buildBreadcrumbs(sourceId, slug);
  const canonicalUrl = `${source.basePath}/${slug.join("/")}`;

  return {
    source: sourceId,
    granularity,
    contentPath,
    highlightPath,
    segments,
    breadcrumbs,
    canonicalUrl,
  };
}

function isValidSegment(segment: string, sourceId: SourceId, index: number): boolean {
  if (segment.includes("..") || segment.includes("\0")) return false;

  if (sourceId === "fr") {
    if (index === 0) return /^\d{4}$/.test(segment);
    if (index === 1) return /^\d{2}$/.test(segment);
    // FR doc numbers: alphanumeric start, hyphens allowed (e.g., "2026-06029")
    if (index === 2) return /^[\w][\w-]+$/.test(segment);
    return false;
  }

  // USC/eCFR: title-NN, chapter-NN, chapter-IV, part-NNN, section-NNN.NNN
  return /^(title|chapter|part|section)-[\w.-]+$/.test(segment);
}

function buildContentPath(sourceId: SourceId, granularity: Granularity, slug: string[]): string {
  // FR uses documents/ directory, not granularity-plural
  if (sourceId === "fr") {
    if (granularity === "document") {
      return `fr/documents/${slug.join("/")}.md`;
    }
    // Year and month index pages have no content file
    return `fr/documents/${slug.join("/")}/_index`;
  }

  // USC/eCFR: {source}/{granularity}s/{path}.md (source-first, plural granularity)
  const granularityDir = `${granularity}s`;
  switch (granularity) {
    case "title":
      return `${sourceId}/${granularityDir}/${slug[0]}.md`;
    case "chapter":
      return `${sourceId}/${granularityDir}/${slug.join("/")}/${slug[slug.length - 1]}.md`;
    case "part":
      return `${sourceId}/${granularityDir}/${slug.join("/")}.md`;
    case "section":
      return `${sourceId}/${granularityDir}/${slug.join("/")}.md`;
    default:
      return `${sourceId}/${granularityDir}/${slug.join("/")}.md`;
  }
}

function parseSegments(slug: string[], sourceId: SourceId): Record<string, string> {
  if (sourceId === "fr") {
    const segments: Record<string, string> = {};
    if (slug[0]) segments["year"] = slug[0];
    if (slug[1]) segments["month"] = slug[1];
    if (slug[2]) segments["document"] = slug[2];
    return segments;
  }

  // USC/eCFR: key by prefix (title, chapter, part, section)
  const segments: Record<string, string> = {};
  for (const s of slug) {
    const prefix = s.split("-")[0];
    if (prefix) segments[prefix] = s;
  }
  return segments;
}

function buildBreadcrumbs(sourceId: SourceId, slug: string[]): Breadcrumb[] {
  const source = getSource(sourceId);
  const crumbs: Breadcrumb[] = [{ label: source.shortName, href: source.basePath }];

  let path = source.basePath;
  for (const [i, segment] of slug.entries()) {
    path = `${path}/${segment}`;
    const label = sourceId === "fr" ? formatFrSegmentLabel(segment, i) : formatSegmentLabel(segment);
    crumbs.push({ label, href: path });
  }

  return crumbs;
}

/** Format a USC/eCFR slug segment into a readable label. */
function formatSegmentLabel(segment: string): string {
  const [prefix, ...rest] = segment.split("-");
  const value = rest.join("-");

  switch (prefix) {
    case "title":
      return `Title ${value}`;
    case "chapter":
      return `Chapter ${value}`;
    case "part":
      return `Part ${value}`;
    case "section":
      return `§ ${value}`;
    default:
      return segment;
  }
}

/** Format an FR slug segment into a readable label. */
function formatFrSegmentLabel(segment: string, index: number): string {
  if (index === 0) return segment; // Year: "2026"
  if (index === 1) {
    const monthNum = parseInt(segment, 10);
    return MONTH_NAMES[monthNum - 1] ?? segment; // "03" → "March"
  }
  return segment; // Document number: "2026-04000"
}

/** Get month name from 1-based month number. Exported for use in FR pages. */
export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? String(month);
}
