/** Configuration for a content source exposed via the API. */
export interface ApiSourceConfig {
  /** Source identifier used in URLs and database queries */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short name for compact display */
  shortName: string;
  /** Description for API docs */
  description: string;
  /** URL prefix (e.g., "/usc", "/cfr", "/fr") */
  urlPrefix: string;
  /** Hierarchical levels in order (e.g., ["title", "chapter", "section"]) */
  hierarchy: string[];
  /** Fields available for filtering */
  filterableFields: string[];
  /** Fields available for sorting */
  sortableFields: string[];
  /** Whether this source uses title_number for hierarchy */
  hasTitles: boolean;
}

/** Static metadata for all content sources. */
export const API_SOURCES: Record<string, ApiSourceConfig> = {
  usc: {
    id: "usc",
    name: "United States Code",
    shortName: "USC",
    description: "General and permanent federal statutes organized into 54 titles.",
    urlPrefix: "/usc",
    hierarchy: ["title", "chapter", "section"],
    filterableFields: ["title_number", "chapter_number", "status", "positive_law", "legal_status"],
    sortableFields: ["title_number", "section_number", "identifier", "last_updated"],
    hasTitles: true,
  },
  cfr: {
    id: "cfr",
    name: "Code of Federal Regulations",
    shortName: "CFR",
    description: "Federal agency regulations organized into 50 titles.",
    urlPrefix: "/cfr",
    hierarchy: ["title", "chapter", "part", "section"],
    filterableFields: ["title_number", "chapter_number", "part_number", "agency", "status", "legal_status"],
    sortableFields: ["title_number", "section_number", "identifier", "last_updated"],
    hasTitles: true,
  },
  fr: {
    id: "fr",
    name: "Federal Register",
    shortName: "FR",
    description: "Daily journal of the U.S. government: rules, proposed rules, notices, and presidential documents.",
    urlPrefix: "/fr",
    hierarchy: ["year", "month", "document"],
    filterableFields: ["document_type", "agency", "publication_date", "effective_date"],
    sortableFields: ["publication_date", "document_number", "identifier"],
    hasTitles: false,
  },
};

/**
 * Maps API URL source identifiers to database source values.
 * The API uses `/cfr/` (content type) but the database stores `source = "ecfr"` (data source).
 */
export const URL_TO_DB_SOURCE: Record<string, string> = {
  usc: "usc",
  cfr: "ecfr",
  fr: "fr",
};
