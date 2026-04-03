/** @lexbuild/core — XML parsing, AST, Markdown rendering, and shared utilities */

// XML parsing
export { XMLParser } from "./xml/parser.js";
export type { Attributes, ParserEvents, XMLParserOptions } from "./xml/parser.js";
export {
  USLM_NS,
  XHTML_NS,
  DC_NS,
  DCTERMS_NS,
  XSI_NS,
  NAMESPACE_PREFIXES,
  LEVEL_ELEMENTS,
  CONTENT_ELEMENTS,
  INLINE_ELEMENTS,
  NOTE_ELEMENTS,
  APPENDIX_LEVEL_ELEMENTS,
  META_ELEMENTS,
  CONTAINER_ELEMENTS,
} from "./xml/uslm-elements.js";

// AST types
export { LEVEL_TYPES, BIG_LEVELS, SMALL_LEVELS } from "./ast/types.js";
export type {
  LevelType,
  LevelNode,
  ContentVariant,
  ContentNode,
  InlineType,
  InlineNode,
  NoteNode,
  SourceCreditNode,
  TableNode,
  TOCItemNode,
  TOCNode,
  NotesContainerNode,
  QuotedContentNode,
  ASTNode,
  AncestorInfo,
  DocumentMeta,
  EmitContext,
  FrontmatterData,
  SourceType,
  LegalStatus,
} from "./ast/types.js";

// AST builder
// AST builder (USLM-specific, aliased for clarity)
export { ASTBuilder } from "./ast/uslm-builder.js";
export { ASTBuilder as UslmASTBuilder } from "./ast/uslm-builder.js";
export type { ASTBuilderOptions } from "./ast/uslm-builder.js";

// Markdown rendering
export { renderDocument, renderSection, renderNode } from "./markdown/renderer.js";
export type { RenderOptions, NotesFilter } from "./markdown/renderer.js";
export { generateFrontmatter, FORMAT_VERSION, GENERATOR } from "./markdown/frontmatter.js";
export { createLinkResolver, parseIdentifier } from "./markdown/links.js";
export type { LinkResolver, ParsedIdentifier } from "./markdown/links.js";

// Resilient filesystem utilities
export { writeFile, mkdir } from "./fs.js";

// Database schema (shared between CLI ingest and Data API)
export { SCHEMA_VERSION, DOCUMENTS_TABLE_SQL, SCHEMA_META_TABLE_SQL, INDEXES_SQL } from "./db/schema.js";
export type { DocumentRow } from "./db/schema.js";

// API keys schema (shared between CLI api-key commands and Data API)
export { deriveApiKeyHash, TIER_DEFAULTS, API_KEYS_TABLE_SQL } from "./db/keys-schema.js";
export type { Tier } from "./db/keys-schema.js";
