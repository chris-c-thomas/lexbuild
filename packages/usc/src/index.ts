/** @lexbuild/usc — U.S. Code-specific element handlers and downloader */

export { convertTitle } from "./converter.js";
export type { ConvertOptions, ConvertResult } from "./converter.js";

export {
  downloadTitles,
  buildDownloadUrl,
  buildAllTitlesUrl,
  releasePointToPath,
  isAllTitles,
  FALLBACK_RELEASE_POINT,
  USC_TITLE_NUMBERS,
} from "./downloader.js";
export type { DownloadOptions, DownloadProgress, DownloadResult, DownloadedFile, DownloadError } from "./downloader.js";

// Release point detection and history
export {
  detectLatestReleasePoint,
  parseReleasePointFromHtml,
  fetchReleasePointHistory,
  parseReleasePointHistoryFromHtml,
} from "./release-points.js";
export type { ReleasePointInfo, HistoricalReleasePointInfo } from "./release-points.js";
