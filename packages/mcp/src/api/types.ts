/**
 * Response types matching the LexBuild Data API.
 * Manually typed to avoid a codegen dependency.
 */

/** Standard API response metadata. */
export interface ApiMeta {
  api_version: string;
  timestamp: string;
}

/** Pagination metadata for list endpoints. */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ── Search ──

/** Parameters for the search endpoint. */
export interface SearchParams {
  q: string;
  source?: "usc" | "ecfr" | "fr" | undefined;
  title_number?: number | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  signal?: AbortSignal | undefined;
}

/** A single search hit. */
export interface SearchHit {
  id: string;
  source: string;
  identifier: string;
  heading: string;
  title_number: number | null;
  title_name: string | null;
  status: string;
  url: string;
  document_type?: string;
  publication_date?: string;
  hierarchy: string[];
  highlights?: {
    heading?: string;
    identifier?: string;
    body?: string;
  };
}

/** Search endpoint response. */
export interface SearchResponse {
  data: {
    hits: SearchHit[];
    query: string;
    processing_time_ms: number;
    estimated_total_hits: number;
  };
  pagination: PaginationMeta;
  meta: ApiMeta;
}

// ── Documents ──

/** Single document response (JSON format). */
export interface DocumentResponse {
  data: {
    id: string;
    identifier: string;
    source: string;
    metadata: Record<string, unknown>;
    body?: string;
  };
  meta: ApiMeta & { format_version?: string };
}

// ── Hierarchy: USC/CFR Titles ──

/** Title summary in list response. */
export interface TitleSummary {
  title_number: number;
  title_name: string | null;
  document_count: number;
  chapter_count: number;
  positive_law: boolean;
  url: string;
}

/** Titles list response. */
export interface TitlesResponse {
  data: TitleSummary[];
  meta: ApiMeta;
}

/** Chapter summary within a title detail. */
export interface ChapterSummary {
  chapter_number: string | null;
  chapter_name: string | null;
  document_count: number;
}

/** Title detail response. */
export interface TitleDetailResponse {
  data: {
    title_number: number;
    title_name: string | null;
    document_count: number;
    positive_law: boolean;
    chapters: ChapterSummary[];
  };
  meta: ApiMeta;
}

// ── Hierarchy: FR Years ──

/** Year summary in list response. */
export interface YearSummary {
  year: number;
  document_count: number;
  url: string;
}

/** Years list response. */
export interface YearsResponse {
  data: YearSummary[];
  meta: ApiMeta;
}

/** Month summary within a year detail. */
export interface MonthSummary {
  month: number;
  document_count: number;
  url: string;
}

/** Year detail response. */
export interface YearDetailResponse {
  data: {
    year: number;
    document_count: number;
    months: MonthSummary[];
  };
  meta: ApiMeta;
}

// ── Health ──

/** Health check response. */
export interface HealthResponse {
  status: string;
  [key: string]: unknown;
}
