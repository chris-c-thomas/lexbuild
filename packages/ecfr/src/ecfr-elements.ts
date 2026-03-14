/**
 * eCFR GPO/SGML-derived XML element classification.
 *
 * The eCFR XML uses a numbered DIV system (DIV1-DIV9) where the TYPE
 * attribute determines the semantic level, not the element name.
 *
 * This element vocabulary is shared by the eCFR bulk data and the
 * annual CFR bulk data on govinfo. If a future @lexbuild/cfr package
 * is created for the annual edition, it can import these classifications.
 */

import type { LevelType, InlineType } from "@lexbuild/core";

/** Map from DIV TYPE attribute values to LexBuild level types */
export const ECFR_TYPE_TO_LEVEL: Readonly<Record<string, LevelType>> = {
  TITLE: "title",
  SUBTITLE: "subtitle",
  CHAPTER: "chapter",
  SUBCHAP: "subchapter",
  PART: "part",
  SUBPART: "subpart",
  SUBJGRP: "subpart", // Subject groups act like subparts
  SECTION: "section",
  APPENDIX: "appendix",
};

/** DIV element names (all route to the TYPE-based level mapping) */
export const ECFR_DIV_ELEMENTS = new Set([
  "DIV1",
  "DIV2",
  "DIV3",
  "DIV4",
  "DIV5",
  "DIV6",
  "DIV7",
  "DIV8",
  "DIV9",
]);

/** Elements that contain text content directly */
export const ECFR_CONTENT_ELEMENTS = new Set([
  "P", // Paragraph (primary content element)
  "FP", // Flush paragraph
  "FP-1", // Indented flush paragraph (level 1)
  "FP-2", // Indented flush paragraph (level 2)
  "FP-DASH", // Dash-leader flush paragraph (form lines)
  "FP1-2", // Alternative indented paragraph
  "FRP", // Flush right paragraph
]);

/** Elements that contain inline formatting */
export const ECFR_INLINE_ELEMENTS = new Set([
  "I", // Italic
  "B", // Bold
  "E", // Emphasis (type varies by T attribute)
  "SU", // Superscript
  "FR", // Fraction
  "AC", // Accent/diacritical
]);

/** Map from E element T attribute to InlineType */
export const ECFR_EMPHASIS_MAP: Readonly<Record<string, InlineType>> = {
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

/** Note-like elements */
export const ECFR_NOTE_ELEMENTS = new Set([
  "AUTH", // Authority citation
  "SOURCE", // Source/provenance note
  "EDNOTE", // Editorial note
  "EFFDNOT", // Effective date note
  "CITA", // Citation / amendment history
  "APPRO", // OMB approval note
  "NOTE", // General note
  "CROSSREF", // Cross-reference block
  "SECAUTH", // Section-level authority
  "FTNT", // Footnote
]);

/** Sub-heading elements within sections/appendices */
export const ECFR_HEADING_ELEMENTS = new Set(["HD1", "HD2", "HD3"]);

/** Block-level elements that wrap content */
export const ECFR_BLOCK_ELEMENTS = new Set([
  "EXTRACT", // Extracted/quoted text
  "EXAMPLE", // Example text
]);

/** Elements to fully ignore (skip entire subtree) */
export const ECFR_IGNORE_ELEMENTS = new Set([
  "CFRTOC", // Table of contents (skip subtree)
  "HEADER", // File metadata header (skip subtree)
]);

/** Elements that are transparent wrappers — pass through without creating frames */
export const ECFR_PASSTHROUGH_ELEMENTS = new Set(["DLPSTEXTCLASS", "TEXT", "BODY", "ECFRBRWS"]);

/** Self-contained elements to skip (no subtree concerns) */
export const ECFR_SKIP_ELEMENTS = new Set([
  "PTHD", // Part heading in TOC
  "CHAPTI", // Chapter item in TOC
  "SECHD", // Section heading in TOC
  "SUBJECT", // Subject text in TOC
  "RESERVED", // Reserved placeholder
  "PG", // Page number
  "STARS", // Visual separator
  "AMDDATE", // Amendment date
]);

/** Cross-reference elements */
export const ECFR_REF_ELEMENTS = new Set([
  "XREF", // Cross-reference link
  "FTREF", // Footnote reference marker
]);

/** Table elements (HTML-style) */
export const ECFR_TABLE_ELEMENTS = new Set(["TABLE", "TR", "TH", "TD"]);
