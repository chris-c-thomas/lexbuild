/**
 * OLRC U.S. Code XML downloader.
 *
 * Downloads USC title XML zip files from the Office of the Law Revision Counsel
 * and extracts them to a local directory.
 */

import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { open as yauzlOpen } from "yauzl";
import type { ZipFile, Entry } from "yauzl";

// ---------------------------------------------------------------------------
// Release point configuration
// ---------------------------------------------------------------------------

/**
 * Current OLRC release point.
 *
 * Update this value when OLRC publishes a new release point.
 * The release point appears in download URLs and identifies which
 * public laws are incorporated. Format: "{congress}-{law}[not{excluded}]"
 *
 * Check https://uscode.house.gov/download/download.shtml for the latest.
 */
export const CURRENT_RELEASE_POINT = "119-73not60";

/** OLRC base URL for release point downloads */
const OLRC_BASE_URL = "https://uscode.house.gov/download/releasepoints/us/pl";

/** Valid USC title numbers (1-54) */
export const USC_TITLE_NUMBERS = Array.from({ length: 54 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Options for downloading USC XML files */
export interface DownloadOptions {
  /** Directory to save downloaded XML files */
  outputDir: string;
  /** Specific title numbers to download, or undefined for all */
  titles?: number[] | undefined;
  /** Release point override (default: CURRENT_RELEASE_POINT) */
  releasePoint?: string | undefined;
}

/** Result of a download operation */
export interface DownloadResult {
  /** Release point used */
  releasePoint: string;
  /** Files successfully downloaded and extracted */
  files: DownloadedFile[];
  /** Titles that failed to download */
  errors: DownloadError[];
}

/** A successfully downloaded file */
export interface DownloadedFile {
  /** Title number */
  titleNumber: number;
  /** Path to the extracted XML file */
  filePath: string;
  /** Size in bytes */
  size: number;
}

/** A failed download */
export interface DownloadError {
  /** Title number */
  titleNumber: number;
  /** Error message */
  message: string;
}

/**
 * Download USC title XML files from OLRC.
 */
export async function downloadTitles(options: DownloadOptions): Promise<DownloadResult> {
  const releasePoint = options.releasePoint ?? CURRENT_RELEASE_POINT;
  const titles = options.titles ?? USC_TITLE_NUMBERS;

  await mkdir(options.outputDir, { recursive: true });

  const files: DownloadedFile[] = [];
  const errors: DownloadError[] = [];

  for (const titleNum of titles) {
    try {
      const file = await downloadAndExtractTitle(titleNum, releasePoint, options.outputDir);
      files.push(file);
    } catch (err) {
      errors.push({
        titleNumber: titleNum,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { releasePoint, files, errors };
}

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

/**
 * Build the download URL for a single title's XML zip.
 *
 * Format: {base}/pl/{releasePointPath}/xml_usc{NN}@{releasePoint}.zip
 *
 * The release point path splits the release point into directory segments.
 * For "119-73not60", the path is "119/73not60".
 */
export function buildDownloadUrl(titleNumber: number, releasePoint: string): string {
  const paddedTitle = titleNumber.toString().padStart(2, "0");
  const rpPath = releasePointToPath(releasePoint);
  return `${OLRC_BASE_URL}/${rpPath}/xml_usc${paddedTitle}@${releasePoint}.zip`;
}

/**
 * Build the download URL for all titles in a single zip.
 */
export function buildAllTitlesUrl(releasePoint: string): string {
  const rpPath = releasePointToPath(releasePoint);
  return `${OLRC_BASE_URL}/${rpPath}/xml_uscAll@${releasePoint}.zip`;
}

/**
 * Convert a release point string to a URL path segment.
 * "119-73not60" → "119/73not60"
 * "119-43" → "119/43"
 */
export function releasePointToPath(releasePoint: string): string {
  // Split on the first hyphen only
  const dashIndex = releasePoint.indexOf("-");
  if (dashIndex === -1) return releasePoint;
  return `${releasePoint.slice(0, dashIndex)}/${releasePoint.slice(dashIndex + 1)}`;
}

// ---------------------------------------------------------------------------
// Download and extraction
// ---------------------------------------------------------------------------

/**
 * Download a single title's zip and extract the XML file.
 */
async function downloadAndExtractTitle(
  titleNumber: number,
  releasePoint: string,
  outputDir: string,
): Promise<DownloadedFile> {
  const url = buildDownloadUrl(titleNumber, releasePoint);
  const paddedTitle = titleNumber.toString().padStart(2, "0");
  const zipPath = join(outputDir, `usc${paddedTitle}.zip`);
  const xmlFileName = `usc${paddedTitle}.xml`;
  const xmlPath = join(outputDir, xmlFileName);

  // Download the zip file
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
  }

  if (!response.body) {
    throw new Error(`No response body for ${url}`);
  }

  // Write zip to disk
  const fileStream = createWriteStream(zipPath);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- ReadableStream type mismatch between DOM and Node
  await pipeline(Readable.fromWeb(response.body as never), fileStream);

  // Extract XML from zip
  await extractXmlFromZip(zipPath, xmlFileName, xmlPath);

  // Clean up zip file
  await unlink(zipPath);

  // Get file size
  const fileStat = await stat(xmlPath);

  return {
    titleNumber,
    filePath: xmlPath,
    size: fileStat.size,
  };
}

/**
 * Extract a specific XML file from a zip archive.
 */
function extractXmlFromZip(zipPath: string, targetFileName: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzlOpen(zipPath, { lazyEntries: true }, (err, zipFile) => {
      if (err) {
        reject(new Error(`Failed to open zip: ${err.message}`));
        return;
      }
      if (!zipFile) {
        reject(new Error("Failed to open zip: no zipFile returned"));
        return;
      }

      let found = false;

      zipFile.on("entry", (entry: Entry) => {
        // Look for the target XML file (might be at root or in a subdirectory)
        const fileName = entry.fileName.split("/").pop() ?? entry.fileName;
        if (fileName === targetFileName || entry.fileName.endsWith(`.xml`)) {
          found = true;
          extractEntry(zipFile, entry, outputPath)
            .then(() => {
              zipFile.close();
              resolve();
            })
            .catch((extractErr) => {
              zipFile.close();
              reject(extractErr);
            });
        } else {
          zipFile.readEntry();
        }
      });

      zipFile.on("end", () => {
        if (!found) {
          reject(new Error(`${targetFileName} not found in zip`));
        }
      });

      zipFile.on("error", (zipErr: Error) => {
        reject(new Error(`Zip error: ${zipErr.message}`));
      });

      zipFile.readEntry();
    });
  });
}

/**
 * Extract a single zip entry to a file.
 */
function extractEntry(zipFile: ZipFile, entry: Entry, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (err, readStream) => {
      if (err) {
        reject(new Error(`Failed to read zip entry: ${err.message}`));
        return;
      }
      if (!readStream) {
        reject(new Error("No read stream for zip entry"));
        return;
      }

      const writeStream = createWriteStream(outputPath);
      readStream.pipe(writeStream);

      writeStream.on("finish", () => resolve());
      writeStream.on("error", (writeErr) => reject(new Error(`Write error: ${writeErr.message}`)));
      readStream.on("error", (readErr) => reject(new Error(`Read error: ${readErr.message}`)));
    });
  });
}
