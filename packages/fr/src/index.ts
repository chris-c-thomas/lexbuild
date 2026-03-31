/**
 * @lexbuild/fr — Federal Register XML to Markdown converter.
 *
 * Converts Federal Register XML (GPO/SGML-derived) to structured Markdown
 * with YAML frontmatter enriched by FederalRegister.gov API metadata.
 *
 * @packageDocumentation
 */

// AST Builder
export { FrASTBuilder } from "./fr-builder.js";
export type { FrASTBuilderOptions, FrDocumentXmlMeta } from "./fr-builder.js";

// Element classification
export {
  FR_DOCUMENT_ELEMENTS,
  FR_DOCUMENT_TYPE_KEYS,
  FR_SECTION_CONTAINERS,
  FR_DOCUMENT_TYPE_MAP,
  FR_PREAMBLE_SECTIONS,
  FR_PREAMBLE_META_ELEMENTS,
  FR_CONTENT_ELEMENTS,
  FR_HEADING_ELEMENT,
  FR_HD_SOURCE_TO_DEPTH,
  FR_INLINE_ELEMENTS,
  FR_EMPHASIS_MAP,
  FR_REGTEXT_ELEMENTS,
  FR_SIGNATURE_ELEMENTS,
  FR_PRESIDENTIAL_SUBTYPES,
  FR_NOTE_ELEMENTS,
  FR_TABLE_ELEMENTS,
  FR_BLOCK_ELEMENTS,
  FR_IGNORE_ELEMENTS,
  FR_SKIP_ELEMENTS,
  FR_PASSTHROUGH_ELEMENTS,
} from "./fr-elements.js";
export type { FrDocumentType } from "./fr-elements.js";

// Frontmatter builder
export { buildFrFrontmatter } from "./fr-frontmatter.js";
export type { FrDocumentJsonMeta } from "./fr-frontmatter.js";

// Output path builder
export {
  buildFrOutputPath,
  buildFrDownloadXmlPath,
  buildFrDownloadJsonPath,
  buildMonthDir,
  buildYearDir,
} from "./fr-path.js";

// Converter
export { convertFrDocuments } from "./converter.js";
export type { FrConvertOptions, FrConvertResult } from "./converter.js";

// Downloader
export { downloadFrDocuments, downloadSingleFrDocument, buildFrApiListUrl } from "./downloader.js";
export type {
  FrDownloadOptions,
  FrDownloadResult,
  FrDownloadedFile,
  FrDownloadFailure,
  FrDownloadProgress,
} from "./downloader.js";
