// ---------------------------------------------------------------------------
// Source registry
// ---------------------------------------------------------------------------

/** Supported content sources */
export type SourceId = "usc" | "ecfr";

/** Granularity levels (superset across all sources) */
export type Granularity = "section" | "chapter" | "part" | "title";

/** Source metadata for registry/routing */
export interface SourceConfig {
  id: SourceId;
  name: string;
  shortName: string;
  description: string;
  basePath: string;
  granularities: Granularity[];
  hierarchy: string[];
  titleCount: number;
  chapterCount: number;
  sectionCount: number;
  partCount?: number;
  /** Slug segment count → granularity mapping */
  slugGranularity: Record<number, Granularity>;
}

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

/** Resolved route from a slug array */
export interface ResolvedRoute {
  source: SourceId;
  granularity: Granularity;
  contentPath: string;
  highlightPath: string;
  segments: Record<string, string>;
  breadcrumbs: Breadcrumb[];
  canonicalUrl: string;
}

export interface Breadcrumb {
  label: string;
  href: string;
}

/** Parsed frontmatter — superset of all source fields */
export interface ContentFrontmatter {
  // Required (all sources)
  identifier: string;
  source: SourceId;
  legal_status: string;
  title: string;
  title_number: number;
  title_name: string;
  positive_law: boolean;
  currency: string;
  last_updated: string;
  format_version: string;
  generator: string;

  // Section/chapter context (optional, depends on granularity)
  section_number?: string;
  section_name?: string;
  chapter_number?: number;
  chapter_name?: string;
  subchapter_number?: string;
  subchapter_name?: string;
  part_number?: string;
  part_name?: string;

  // USC-specific
  source_credit?: string;
  status?: string;

  // eCFR-specific
  authority?: string;
  regulatory_source?: string;
  agency?: string;
  cfr_part?: string;
  cfr_subpart?: string;

  // Title-level enriched
  chapter_count?: number;
  section_count?: number;
  part_count?: number;
  total_token_estimate?: number;
}

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------

/** Title summary for index pages and sidebar root */
export interface TitleSummary {
  number: number;
  name: string;
  directory: string;
  positiveLaw?: boolean;
  chapterCount: number;
  sectionCount: number;
  partCount?: number;
  tokenEstimate: number;
}

/** Chapter navigation entry (sidebar second level) */
export interface ChapterNav {
  number: string;
  name: string;
  directory: string;
  sections?: SectionNavEntry[];
  parts?: PartNav[];
}

/** Part navigation entry (eCFR sidebar third level) */
export interface PartNav {
  number: string;
  name: string;
  directory: string;
  sections: SectionNavEntry[];
}

/** Section navigation entry (sidebar leaf) */
export interface SectionNavEntry {
  number: string;
  name: string;
  file: string;
  status: string;
  hasNotes: boolean;
}

// ---------------------------------------------------------------------------
// SEO types
// ---------------------------------------------------------------------------

/** Fully resolved SEO metadata for a single page. */
export interface PageSEO {
  /** Page title (without " | LexBuild" suffix — SEOHead appends it). */
  title: string;
  /** Meta description. Max ~155 chars for Google snippet display. */
  description: string;
  /** Fully qualified canonical URL. */
  canonicalUrl: string;
  /** Open Graph type. "website" for index/navigation pages, "article" for content pages. */
  ogType: "website" | "article";
  /** Fully qualified OG image URL. */
  ogImage: string;
  /** Optional robots directive override (default: none, which means index/follow). */
  robots?: string;
  /** JSON-LD structured data object(s). Serialized into <script type="application/ld+json">. */
  jsonLd: Record<string, unknown> | Record<string, unknown>[];
  /** When true, render title verbatim without " | LexBuild" suffix. */
  rawTitle?: boolean;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

/** Props passed from Astro pages to the ContentViewer React island */
export interface ContentViewerProps {
  rawMarkdown: string;
  rawYaml: string;
  highlightedSource: string;
  renderedHtml: string;
  frontmatter: ContentFrontmatter;
  granularity: Granularity;
  downloadFilename: string;
}
