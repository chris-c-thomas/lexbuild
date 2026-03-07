/**
 * Flexible frontmatter across all three granularities.
 * Section-level has section_number/section_name.
 * Title-level has chapter_count/section_count/total_token_estimate.
 */
export interface ContentFrontmatter {
  identifier: string;
  title: string;
  title_number: number;
  title_name: string;
  positive_law: boolean;
  currency: string;
  last_updated: string;
  format_version: string;
  generator: string;

  // Section-level (optional — absent in title-level output)
  section_number?: string;
  section_name?: string;
  chapter_number?: number;
  chapter_name?: string;
  subchapter_number?: string;
  subchapter_name?: string;
  part_number?: string;
  part_name?: string;
  source_credit?: string;
  status?: string;

  // Title-level enriched (optional — only in title-level output)
  chapter_count?: number;
  section_count?: number;
  total_token_estimate?: number;
}

/** Summary of a single USC title for navigation/index pages. */
export interface TitleSummary {
  number: number;
  name: string;
  directory: string;
  positiveLaw: boolean;
  chapterCount: number;
  sectionCount: number;
  tokenEstimate: number;
}

/** Full navigation data for a single title. */
export interface TitleNav {
  number: number;
  name: string;
  positiveLaw: boolean;
  chapters: ChapterNav[];
}

/** Navigation entry for a chapter within a title. */
export interface ChapterNav {
  number: number;
  name: string;
  directory: string;
  sections: SectionNavEntry[];
}

/** Navigation entry for a section within a chapter. */
export interface SectionNavEntry {
  number: string;
  name: string;
  file: string; // "section-1" (no .md)
  status: string;
  hasNotes: boolean;
}

/** Props passed from server page components to the ContentViewer client component. */
export interface ContentViewerProps {
  rawMarkdown: string;
  highlightedSource: string;
  renderedHtml: string;
  frontmatter: ContentFrontmatter;
  downloadFilename: string;
}
