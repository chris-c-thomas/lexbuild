import type { SourceId, Granularity, ResolvedRoute, Breadcrumb } from "./types";
import { getSource } from "./sources";

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
 */
export function resolveRoute(
  sourceId: SourceId,
  slug: string[] | undefined,
): ResolvedRoute | null {
  if (!slug || slug.length === 0) return null;

  const source = getSource(sourceId);
  const granularity = source.slugGranularity[slug.length];
  if (!granularity) return null;

  // Validate each segment
  for (const segment of slug) {
    if (!isValidSegment(segment)) return null;
  }

  const segments = parseSegments(slug);
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

function isValidSegment(segment: string): boolean {
  // Allow: title-NN, chapter-NN, chapter-IV, part-NNN, section-NNN.NNN, section-NNNa
  // Block: .., /, \, null bytes
  return (
    /^(title|chapter|part|section)-[\w.-]+$/.test(segment) &&
    !segment.includes("..") &&
    !segment.includes("\0")
  );
}

function buildContentPath(sourceId: SourceId, granularity: Granularity, slug: string[]): string {
  // Path format: {source}/{granularity}s/{path}.md (source-first, plural granularity)
  const granularityDir = `${granularity}s`; // section → sections, title → titles, etc.
  switch (granularity) {
    case "title":
      // usc/titles/title-01.md
      return `${sourceId}/${granularityDir}/${slug[0]}.md`;
    case "chapter":
      // usc/chapters/title-01/chapter-01/chapter-01.md (file inside its own dir)
      return `${sourceId}/${granularityDir}/${slug.join("/")}/${slug[slug.length - 1]}.md`;
    case "part":
      // ecfr/parts/title-17/chapter-IV/part-240.md (file directly in parent dir)
      return `${sourceId}/${granularityDir}/${slug.join("/")}.md`;
    case "section":
      // usc/sections/title-01/chapter-01/section-1.md (file directly in parent dir)
      // ecfr/sections/title-17/chapter-IV/part-240/section-240.10b-5.md (same pattern)
      return `${sourceId}/${granularityDir}/${slug.join("/")}.md`;
  }
}

function parseSegments(slug: string[]): Record<string, string> {
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
  for (const segment of slug) {
    path = `${path}/${segment}`;
    crumbs.push({ label: formatSegmentLabel(segment), href: path });
  }

  return crumbs;
}

/** Format a slug segment into a readable label. */
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
