/** @law2md/core — XML parsing, AST, Markdown rendering, and shared utilities */

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
} from "./xml/namespace.js";

// AST types
export {
  LEVEL_TYPES,
  BIG_LEVELS,
  SMALL_LEVELS,
} from "./ast/types.js";
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
} from "./ast/types.js";

// AST builder
export { ASTBuilder } from "./ast/builder.js";
export type { ASTBuilderOptions } from "./ast/builder.js";

// Markdown rendering
export { renderDocument, renderSection, renderNode } from "./markdown/renderer.js";
export type { RenderOptions, NotesFilter } from "./markdown/renderer.js";
export { generateFrontmatter, FORMAT_VERSION, GENERATOR } from "./markdown/frontmatter.js";
export { createLinkResolver, parseIdentifier } from "./markdown/links.js";
export type { LinkResolver, ParsedIdentifier } from "./markdown/links.js";

