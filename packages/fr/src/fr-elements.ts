/**
 * Federal Register XML element classification.
 *
 * The FR XML is GPO/SGML-derived with no namespace. It shares many
 * inline formatting elements with eCFR (E T="nn", SU, FTNT) but uses
 * a flat document-centric structure rather than a hierarchical DIV system.
 *
 * Each FR document (RULE, PRORULE, NOTICE, PRESDOCU) contains a preamble
 * (PREAMB) with structured metadata, supplementary information (SUPLINF)
 * with the document body, and optional regulatory text (REGTEXT).
 */

import type { InlineType } from "@lexbuild/core";

// ── Document type elements ──

/** FR document type element names as a const tuple — single source of truth */
export const FR_DOCUMENT_TYPE_KEYS = ["RULE", "PRORULE", "NOTICE", "PRESDOCU"] as const;

/** FR document types supported by the API and XML */
export type FrDocumentType = (typeof FR_DOCUMENT_TYPE_KEYS)[number];

/** Top-level document elements — each becomes an emitted section-level node */
export const FR_DOCUMENT_ELEMENTS = new Set<string>(FR_DOCUMENT_TYPE_KEYS);

/** Container elements that group documents within daily issues */
export const FR_SECTION_CONTAINERS = new Set([
  "RULES",
  "PRORULES",
  "NOTICES",
  "PRESDOCS",
]);

/** Map from document element name to normalized document type string */
export const FR_DOCUMENT_TYPE_MAP: Readonly<Record<string, string>> = {
  RULE: "rule",
  PRORULE: "proposed_rule",
  NOTICE: "notice",
  PRESDOCU: "presidential_document",
};

// ── Preamble elements ──

/** Preamble section elements containing structured content */
export const FR_PREAMBLE_SECTIONS = new Set([
  "AGY", // Agency section (HD + P)
  "ACT", // Action section (HD + P)
  "SUM", // Summary section (HD + P)
  "DATES", // Dates section (HD + P)
  "EFFDATE", // Effective date section (HD + P)
  "ADD", // Addresses section (HD + P)
  "FURINF", // Further information section (HD + P)
]);

/** Preamble metadata elements — text extracted for frontmatter */
export const FR_PREAMBLE_META_ELEMENTS = new Set([
  "AGENCY", // Issuing agency name (attrs: TYPE)
  "SUBAGY", // Sub-agency name
  "CFR", // CFR citation affected (e.g., "10 CFR Part 2")
  "SUBJECT", // Document title/subject
  "DEPDOC", // Department document number
  "RIN", // Regulation Identifier Number
]);

// ── Content elements ──

/** Elements that contain paragraph text */
export const FR_CONTENT_ELEMENTS = new Set([
  "P", // Paragraph
  "FP", // Flush paragraph (attrs: SOURCE for indent level)
]);

/** Heading element — level determined by SOURCE attribute */
export const FR_HEADING_ELEMENT = "HD";

/**
 * Map from HD SOURCE attribute to heading depth.
 * HED = top-level (section-like), HD1 = subsection, etc.
 */
export const FR_HD_SOURCE_TO_DEPTH: Readonly<Record<string, number>> = {
  HED: 1,
  HD1: 2,
  HD2: 3,
  HD3: 4,
  HD4: 5,
  HD5: 6,
  HD6: 6,
  HD8: 6,
};

// ── Inline formatting ──

/** Inline formatting elements */
export const FR_INLINE_ELEMENTS = new Set([
  "I", // Italic
  "B", // Bold
  "E", // Emphasis (type varies by T attribute)
  "SU", // Superscript / footnote marker
  "FR", // Fraction
  "AC", // Accent/diacritical
]);

/**
 * Map from E element T attribute to InlineType.
 * Duplicated from eCFR — source packages must not import each other.
 */
export const FR_EMPHASIS_MAP: Readonly<Record<string, InlineType>> = {
  "01": "bold",
  "02": "italic",
  "03": "bold", // bold italic in print — treat as bold for Markdown
  "04": "italic", // italic in headings
  "05": "italic", // small caps — render as italic
  "51": "sub", // subscript
  "52": "sub", // subscript
  "54": "sub", // subscript (math)
  "7462": "italic", // special terms (et seq., De minimis)
};

// ── Regulatory text elements ──

/** Regulatory text amendment elements (within SUPLINF) */
export const FR_REGTEXT_ELEMENTS = new Set([
  "REGTEXT", // Regulatory text container (attrs: TITLE, PART)
  "AMDPAR", // Amendment instruction paragraph
  "SECTION", // Section container
  "SECTNO", // Section number designation
  "PART", // Part container within REGTEXT
  "AUTH", // Authority citation in REGTEXT
]);

/** LSTSUB — List of subjects (CFR parts affected) */
export const FR_LSTSUB_ELEMENT = "LSTSUB";

// ── Signature block ──

/** Signature block elements */
export const FR_SIGNATURE_ELEMENTS = new Set([
  "SIG", // Signature block container
  "NAME", // Signer name
  "TITLE", // Signer title
  "DATED", // Date of signature
]);

// ── Presidential document subtypes ──

/** Presidential document subtype containers */
export const FR_PRESIDENTIAL_SUBTYPES = new Set([
  "EXECORD", // Executive Order
  "PRMEMO", // Presidential Memorandum
  "PROCLA", // Proclamation
  "DETERM", // Presidential Determination
  "PRNOTICE", // Presidential Notice
  "PRORDER", // Presidential Order
]);

/** Presidential document metadata elements */
export const FR_PRESIDENTIAL_META_ELEMENTS = new Set([
  "PSIG", // Presidential signature (initials)
  "PLACE", // Place of issuance
  "TITLE3", // CFR Title 3 marker
  "PRES", // President name
]);

// ── Note elements ──

/** Footnote and editorial note elements */
export const FR_NOTE_ELEMENTS = new Set([
  "FTNT", // Footnote
  "EDNOTE", // Editorial note
  "OLNOTE1", // Overlay note
]);

/** Footnote reference marker */
export const FR_FTREF_ELEMENT = "FTREF";

// ── Block elements ──

/** Block-level content wrappers */
export const FR_BLOCK_ELEMENTS = new Set([
  "EXTRACT", // Extracted/quoted text
  "EXAMPLE", // Illustrative example
]);

// ── Table elements (GPOTABLE format) ──

/** GPOTABLE elements */
export const FR_TABLE_ELEMENTS = new Set([
  "GPOTABLE", // Table root
  "TTITLE", // Table title
  "BOXHD", // Header box container
  "CHED", // Column header entry (attrs: H for level)
  "ROW", // Data row (attrs: RUL for horizontal rules)
  "ENT", // Cell entry (attrs: I for indent, A for alignment)
]);

// ── Elements to ignore (skip entire subtree) ──

/** Elements whose entire subtree should be skipped */
export const FR_IGNORE_ELEMENTS = new Set([
  "CNTNTS", // Table of contents in daily issue
  "GPH", // Graphics (not available in XML)
  "GID", // Graphics ID
]);

// ── Elements to skip (self only, no subtree) ──

/** Self-contained elements to skip — metadata extracted elsewhere or irrelevant */
export const FR_SKIP_ELEMENTS = new Set([
  "PRTPAGE", // Page number reference (attrs: P for page)
  "STARS", // Visual separator (****)
  "FILED", // Filing info
  "UNITNAME", // Section name in daily issue
  "VOL", // Volume number (daily issue metadata)
  "NO", // Issue number (daily issue metadata)
  "DATE", // Date (daily issue level — document dates from preamble)
  "NEWPART", // New part container in daily issue
  "PTITLE", // Part title in daily issue
  "PARTNO", // Part number in daily issue
  "PNOTICE", // Part notice text
]);

// ── Passthrough elements ──

/** Transparent wrappers — pass through without creating frames */
export const FR_PASSTHROUGH_ELEMENTS = new Set([
  "FEDREG", // Daily issue root element
  "PREAMB", // Preamble — children are handled individually
  "SUPLINF", // Supplementary information — children are handled individually
]);

// ── Metadata extraction elements ──

/** FRDOC — Federal Register document citation, e.g., "[FR Doc. 2026-06029 ...]" */
export const FR_FRDOC_ELEMENT = "FRDOC";

/** BILCOD — Billing code (skip) */
export const FR_BILCOD_ELEMENT = "BILCOD";
