/** @lexbuild/ecfr — Electronic Code of Federal Regulations conversion */

// Converter
export { convertEcfrTitle } from "./converter.js";
export type { EcfrConvertOptions, EcfrConvertResult } from "./converter.js";

// Downloader (govinfo bulk data)
export { downloadEcfrTitles, buildEcfrDownloadUrl, ECFR_TITLE_COUNT, ECFR_TITLE_NUMBERS } from "./downloader.js";
export type {
  EcfrDownloadOptions,
  EcfrDownloadProgress,
  EcfrDownloadResult,
  EcfrDownloadedFile,
  EcfrDownloadError,
} from "./downloader.js";

// Downloader (eCFR API — daily-updated, point-in-time)
export { downloadEcfrTitlesFromApi, buildEcfrApiDownloadUrl, fetchEcfrTitlesMeta } from "./ecfr-api-downloader.js";
export type {
  EcfrApiDownloadOptions,
  EcfrApiDownloadResult,
  EcfrApiDownloadedFile,
  EcfrTitleMeta,
  EcfrTitlesResponse,
} from "./ecfr-api-downloader.js";

// AST Builder
export { EcfrASTBuilder } from "./ecfr-builder.js";
export type { EcfrASTBuilderOptions } from "./ecfr-builder.js";

// Re-export element classifications for reuse by @lexbuild/cfr (annual edition)
export {
  ECFR_TYPE_TO_LEVEL,
  ECFR_DIV_ELEMENTS,
  ECFR_CONTENT_ELEMENTS,
  ECFR_INLINE_ELEMENTS,
  ECFR_EMPHASIS_MAP,
  ECFR_NOTE_ELEMENTS,
  ECFR_HEADING_ELEMENTS,
  ECFR_BLOCK_ELEMENTS,
  ECFR_IGNORE_ELEMENTS,
  ECFR_PASSTHROUGH_ELEMENTS,
  ECFR_SKIP_ELEMENTS,
  ECFR_REF_ELEMENTS,
  ECFR_TABLE_ELEMENTS,
} from "./ecfr-elements.js";
