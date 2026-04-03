/**
 * @lexbuild/core — Shared database schema definitions
 *
 * Provides SQLite schema constants and TypeScript types used by both
 * the CLI ingest command (writer) and the Data API (reader).
 *
 * This module does NOT depend on any SQLite driver — it exports only
 * string SQL statements and TypeScript interfaces.
 */

/** Schema version for migration tracking */
export const SCHEMA_VERSION = 1;

/** SQL to create the documents table */
export const DOCUMENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  -- Primary key: sanitized identifier (same convention as Meilisearch)
  id              TEXT PRIMARY KEY,

  -- Source discriminator
  source          TEXT NOT NULL CHECK (source IN ('usc', 'ecfr', 'fr')),

  -- Canonical identifier (e.g., "/us/usc/t1/s1", "/us/cfr/t17/s240.10b-5", "/us/fr/2026-06029")
  identifier      TEXT NOT NULL UNIQUE,

  -- Structural metadata (denormalized for filtering)
  title_number    INTEGER,
  title_name      TEXT,
  section_number  TEXT,
  section_name    TEXT,
  chapter_number  TEXT,
  chapter_name    TEXT,
  subchapter_number TEXT,
  subchapter_name TEXT,
  part_number     TEXT,
  part_name       TEXT,

  -- Legal classification
  legal_status    TEXT NOT NULL,
  positive_law    INTEGER NOT NULL DEFAULT 0,
  status          TEXT,
  currency        TEXT,
  last_updated    TEXT,

  -- Display
  display_title   TEXT NOT NULL,

  -- FR-specific fields
  document_number TEXT,
  document_type   TEXT,
  publication_date TEXT,
  agency          TEXT,
  fr_citation     TEXT,
  fr_volume       INTEGER,
  effective_date  TEXT,
  comments_close_date TEXT,
  fr_action       TEXT,

  -- eCFR/CFR-specific fields
  authority       TEXT,
  regulatory_source TEXT,
  cfr_part        TEXT,
  cfr_subpart     TEXT,

  -- Multi-value fields (stored as JSON arrays)
  agencies        TEXT,
  cfr_references  TEXT,
  docket_ids      TEXT,

  -- Source credit (USC)
  source_credit   TEXT,

  -- Content
  frontmatter_yaml TEXT NOT NULL,
  markdown_body    TEXT NOT NULL,

  -- Ingestion metadata
  file_path       TEXT NOT NULL,
  content_hash    TEXT NOT NULL,
  format_version  TEXT NOT NULL,
  generator       TEXT NOT NULL,
  ingested_at     TEXT NOT NULL DEFAULT (datetime('now'))
)
`;

/** SQL to create the schema metadata table */
export const SCHEMA_META_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
`;

/** SQL statements to create indexes on the documents table */
export const INDEXES_SQL = [
  // Source-scoped queries (most common pattern)
  "CREATE INDEX IF NOT EXISTS idx_doc_source ON documents(source)",
  "CREATE INDEX IF NOT EXISTS idx_doc_source_title ON documents(source, title_number)",
  "CREATE INDEX IF NOT EXISTS idx_doc_source_title_chapter ON documents(source, title_number, chapter_number)",

  // Identifier lookup (single-document retrieval)
  "CREATE INDEX IF NOT EXISTS idx_doc_identifier ON documents(identifier)",

  // FR-specific queries
  "CREATE INDEX IF NOT EXISTS idx_doc_publication_date ON documents(publication_date) WHERE publication_date IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS idx_doc_document_type ON documents(source, document_type) WHERE document_type IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS idx_doc_agency ON documents(agency) WHERE agency IS NOT NULL",

  // Status filtering
  "CREATE INDEX IF NOT EXISTS idx_doc_source_status ON documents(source, status)",

  // Incremental ingestion (find changed files)
  "CREATE INDEX IF NOT EXISTS idx_doc_file_path ON documents(file_path)",
  "CREATE INDEX IF NOT EXISTS idx_doc_content_hash ON documents(content_hash)",
] as const;

/**
 * TypeScript representation of a row in the documents table.
 *
 * Used by the CLI ingest command to write rows and by the Data API to read them.
 * Column types mirror SQLite storage: TEXT maps to string, INTEGER maps to number.
 */
export interface DocumentRow {
  /** Primary key — sanitized identifier */
  id: string;
  /** Content source: "usc", "ecfr", or "fr" */
  source: string;
  /** Canonical identifier (e.g., "/us/usc/t1/s1") */
  identifier: string;
  /** Title number (e.g., 1 for Title 1) */
  title_number: number | null;
  /** Title name (e.g., "General Provisions") */
  title_name: string | null;
  /** Section number (string — can be alphanumeric) */
  section_number: string | null;
  /** Section name */
  section_name: string | null;
  /** Chapter number (TEXT — eCFR uses Roman numerals) */
  chapter_number: string | null;
  /** Chapter name */
  chapter_name: string | null;
  /** Subchapter number */
  subchapter_number: string | null;
  /** Subchapter name */
  subchapter_name: string | null;
  /** Part number (string — can be alphanumeric) */
  part_number: string | null;
  /** Part name */
  part_name: string | null;
  /** Legal provenance status */
  legal_status: string;
  /** Whether this title is positive law (1 = true, 0 = false) */
  positive_law: number;
  /** Section status (e.g., "repealed", "transferred") */
  status: string | null;
  /** Release point or currency identifier */
  currency: string | null;
  /** ISO date from source generation timestamp */
  last_updated: string | null;
  /** Human-readable display title */
  display_title: string;
  /** FR document number */
  document_number: string | null;
  /** Document type (FR: rule, proposed_rule, notice, presidential_document) */
  document_type: string | null;
  /** Publication date (FR documents) */
  publication_date: string | null;
  /** Primary agency (first element of agencies array) */
  agency: string | null;
  /** FR citation string */
  fr_citation: string | null;
  /** FR volume number */
  fr_volume: number | null;
  /** Effective date */
  effective_date: string | null;
  /** Comments close date */
  comments_close_date: string | null;
  /** FR action description */
  fr_action: string | null;
  /** CFR authority citation */
  authority: string | null;
  /** Regulatory source */
  regulatory_source: string | null;
  /** CFR part number */
  cfr_part: string | null;
  /** CFR subpart */
  cfr_subpart: string | null;
  /** JSON array of agency names */
  agencies: string | null;
  /** JSON array of CFR references */
  cfr_references: string | null;
  /** JSON array of docket IDs */
  docket_ids: string | null;
  /** USC source credit line */
  source_credit: string | null;
  /** Raw YAML frontmatter string */
  frontmatter_yaml: string;
  /** Markdown body content (without frontmatter) */
  markdown_body: string;
  /** Relative file path from content directory */
  file_path: string;
  /** SHA-256 content hash for change detection */
  content_hash: string;
  /** Format version from frontmatter */
  format_version: string;
  /** Generator identifier from frontmatter */
  generator: string;
  /** ISO timestamp of ingestion */
  ingested_at: string;
}
