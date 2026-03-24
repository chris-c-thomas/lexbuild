/**
 * OLRC U.S. Code XML downloader.
 *
 * Downloads USC title XML zip files from the Office of the Law Revision Counsel
 * and extracts them to a local directory.
 *
 * By default, auto-detects the latest release point from the OLRC download page.
 * Falls back to a hardcoded release point if detection fails.
 */

import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { open as yauzlOpen } from "yauzl";
import type { ZipFile, Entry } from "yauzl";
import { detectLatestReleasePoint } from "./release-points.js";

// ---------------------------------------------------------------------------
// Release point configuration
// ---------------------------------------------------------------------------

/**
 * Fallback OLRC release point, used when auto-detection fails.
 *
 * The downloader auto-detects the latest release point from the OLRC
 * download page. This constant is only used as a last resort if the
 * page is unreachable or its format changes.
 */
export const FALLBACK_RELEASE_POINT = "119-73not60";

/** OLRC base URL for release point downloads */
const OLRC_BASE_URL = "https://uscode.house.gov/download/releasepoints/us/pl";

/** Valid USC title numbers (1-54) */
export const USC_TITLE_NUMBERS = Array.from({ length: 54 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a list of title numbers covers all 54 USC titles.
 *
 * Handles arbitrary ordering and duplicates.
 */
export function isAllTitles(titles: number[]): boolean {
  const unique = new Set(titles);
  return unique.size === 54 && USC_TITLE_NUMBERS.every((n) => unique.has(n));
}

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
 *
 * Auto-detects the latest release point from the OLRC download page unless
 * an explicit release point is provided via `options.releasePoint`.
 *
 * When all 54 titles are requested, uses the bulk `uscAll` zip for a single
 * HTTP round-trip instead of 54 individual requests. Falls back to per-title
 * downloads if the bulk download fails.
 */
export async function downloadTitles(options: DownloadOptions): Promise<DownloadResult> {
  let releasePoint = options.releasePoint;
  if (!releasePoint) {
    const detected = await detectLatestReleasePoint();
    releasePoint = detected?.releasePoint ?? FALLBACK_RELEASE_POINT;
  }
  const titles = options.titles ?? USC_TITLE_NUMBERS;

  await mkdir(options.outputDir, { recursive: true });

  // Use bulk zip when all 54 titles are requested
  if (options.titles === undefined || isAllTitles(titles)) {
    try {
      const files = await downloadAndExtractAllTitles(releasePoint, options.outputDir);
      return { releasePoint, files, errors: [] };
    } catch {
      // Fall back to per-title downloads
    }
  }

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
  // ReadableStream type mismatch between DOM and Node — cast to `never` to bridge
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
function extractXmlFromZip(
  zipPath: string,
  targetFileName: string,
  outputPath: string,
): Promise<void> {
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

// ---------------------------------------------------------------------------
// Bulk download (all titles in one zip)
// ---------------------------------------------------------------------------

/** Regex matching USC XML filenames like usc01.xml, usc54.xml */
const USC_XML_RE = /^(?:.*\/)?usc(\d{2})\.xml$/;

/**
 * Extract all `usc{NN}.xml` files from a bulk zip archive.
 *
 * Returns an array of `{ titleNumber, filePath }` for each extracted file.
 */
function extractAllXmlFromZip(
  zipPath: string,
  outputDir: string,
): Promise<{ titleNumber: number; filePath: string }[]> {
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

      const extracted: { titleNumber: number; filePath: string }[] = [];
      let pending = 0;
      let ended = false;

      const maybeResolve = (): void => {
        if (ended && pending === 0) {
          resolve(extracted);
        }
      };

      zipFile.on("entry", (entry: Entry) => {
        const match = USC_XML_RE.exec(entry.fileName);
        if (match) {
          const titleNum = parseInt(match[1] ?? "0", 10);
          const outPath = join(outputDir, `usc${match[1] ?? "00"}.xml`);
          pending++;

          extractEntry(zipFile, entry, outPath)
            .then(() => {
              extracted.push({ titleNumber: titleNum, filePath: outPath });
              pending--;
              // Continue reading entries after extraction completes
              zipFile.readEntry();
              maybeResolve();
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
        ended = true;
        maybeResolve();
      });

      zipFile.on("error", (zipErr: Error) => {
        reject(new Error(`Zip error: ${zipErr.message}`));
      });

      zipFile.readEntry();
    });
  });
}

/**
 * Download the bulk all-titles zip and extract every `usc{NN}.xml` file.
 */
async function downloadAndExtractAllTitles(
  releasePoint: string,
  outputDir: string,
): Promise<DownloadedFile[]> {
  const url = buildAllTitlesUrl(releasePoint);
  const zipPath = join(outputDir, "uscAll.zip");

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
  await pipeline(Readable.fromWeb(response.body as never), fileStream);

  // Extract all XML files from zip
  const extracted = await extractAllXmlFromZip(zipPath, outputDir);

  // Clean up zip file
  await unlink(zipPath);

  // Stat each extracted file and build results
  const files: DownloadedFile[] = [];
  for (const { titleNumber, filePath } of extracted) {
    const fileStat = await stat(filePath);
    files.push({ titleNumber, filePath, size: fileStat.size });
  }

  // Sort by title number for consistent ordering
  files.sort((a, b) => a.titleNumber - b.titleNumber);

  return files;
}
