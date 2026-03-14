/**
 * USLM XML namespace constants and element classification utilities.
 */

/** USLM 1.0 default namespace */
export const USLM_NS = "http://xml.house.gov/schemas/uslm/1.0";

/** XHTML namespace (used for tables) */
export const XHTML_NS = "http://www.w3.org/1999/xhtml";

/** Dublin Core elements namespace */
export const DC_NS = "http://purl.org/dc/elements/1.1/";

/** Dublin Core terms namespace */
export const DCTERMS_NS = "http://purl.org/dc/terms/";

/** XML Schema Instance namespace */
export const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";

/**
 * Prefix map for recognized non-default namespaces.
 * Elements in these namespaces will be emitted with the prefix (e.g., "dc:title").
 */
export const NAMESPACE_PREFIXES: Readonly<Record<string, string>> = {
  [XHTML_NS]: "xhtml",
  [DC_NS]: "dc",
  [DCTERMS_NS]: "dcterms",
  [XSI_NS]: "xsi",
};

/** USLM elements that represent hierarchical levels */
export const LEVEL_ELEMENTS = new Set([
  "title",
  "subtitle",
  "chapter",
  "subchapter",
  "article",
  "subarticle",
  "part",
  "subpart",
  "division",
  "subdivision",
  "preliminary",
  "section",
  "subsection",
  "paragraph",
  "subparagraph",
  "clause",
  "subclause",
  "item",
  "subitem",
  "subsubitem",
  // Appendix-level elements
  "appendix",
  "compiledAct",
  "reorganizationPlans",
  "reorganizationPlan",
  "courtRules",
  "courtRule",
]);

/** USLM elements that represent content blocks */
export const CONTENT_ELEMENTS = new Set([
  "content",
  "chapeau",
  "continuation",
  "proviso",
]);

/** USLM elements that represent inline formatting */
export const INLINE_ELEMENTS = new Set([
  "b",
  "i",
  "sub",
  "sup",
  "ref",
  "date",
  "term",
  "inline",
  "shortTitle",
  "del",
  "ins",
]);

/** USLM note-related elements */
export const NOTE_ELEMENTS = new Set([
  "note",
  "notes",
  "sourceCredit",
  "statutoryNote",
  "editorialNote",
  "changeNote",
]);

/** USLM elements that act as levels in appendix contexts */
export const APPENDIX_LEVEL_ELEMENTS = new Set([
  "compiledAct",
  "courtRules",
  "courtRule",
  "reorganizationPlans",
  "reorganizationPlan",
]);

/** USLM metadata elements inside <meta> */
export const META_ELEMENTS = new Set([
  "meta",
  "docNumber",
  "docPublicationName",
  "docReleasePoint",
  "property",
]);

/** Structural container elements (no direct content) */
export const CONTAINER_ELEMENTS = new Set([
  "uscDoc",
  "main",
  "meta",
  "toc",
  "layout",
  "header",
  "row",
  "column",
  "tocItem",
]);
