/** @law2md/usc — U.S. Code-specific element handlers and downloader */

export { convertTitle } from "./converter.js";
export type { ConvertOptions, ConvertResult } from "./converter.js";

export {
  downloadTitles,
  buildDownloadUrl,
  buildAllTitlesUrl,
  releasePointToPath,
  isAllTitles,
  CURRENT_RELEASE_POINT,
  USC_TITLE_NUMBERS,
} from "./downloader.js";
export type { DownloadOptions, DownloadResult, DownloadedFile, DownloadError } from "./downloader.js";
