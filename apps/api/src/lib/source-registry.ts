/** API-facing source identifier (used in URLs). */
export type ApiSourceId = "usc" | "ecfr" | "fr";

/** Database-facing source value (stored in the documents table). */
export type DbSource = "usc" | "ecfr" | "fr";

/** Configuration for a content source exposed via the API. */
export interface ApiSourceConfig {
  id: ApiSourceId;
  name: string;
  shortName: string;
  description: string;
  urlPrefix: string;
  /** Ordered browsing levels (e.g., ["title", "chapter", "section"]) */
  hierarchy: string[];
  filterableFields: string[];
  sortableFields: string[];
  /** Whether this source's top-level grouping is by title_number */
  hasTitles: boolean;
}

/** Static metadata for all content sources. */
export const API_SOURCES: Record<ApiSourceId, ApiSourceConfig> = {
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
  ecfr: {
    id: "ecfr",
    name: "eCFR",
    shortName: "eCFR",
    description: "Electronic Code of Federal Regulations, updated continuously by the Government Publishing Office.",
    urlPrefix: "/ecfr",
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
 * Currently 1:1 — both API and database use "ecfr". When Annual CFR is added,
 * it will use a different API source ID (e.g., "cfr") mapping to its own DB source.
 */
const URL_TO_DB: Record<ApiSourceId, DbSource> = {
  usc: "usc",
  ecfr: "ecfr",
  fr: "fr",
};

const DB_TO_API: Record<DbSource, ApiSourceId> = {
  usc: "usc",
  ecfr: "ecfr",
  fr: "fr",
};

/** Convert an API source ID to its database source value. */
export function toDbSource(apiSource: ApiSourceId): DbSource {
  return URL_TO_DB[apiSource];
}

/** Convert a database source value to the API-facing source ID. */
export function toApiSource(dbSource: string): string {
  return (DB_TO_API as Record<string, string>)[dbSource] ?? dbSource;
}
