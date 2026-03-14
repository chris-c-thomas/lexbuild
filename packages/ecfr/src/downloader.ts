/**
 * eCFR bulk XML downloader.
 *
 * Downloads individual title XML files from govinfo.gov's bulk data repository.
 * Unlike the USC downloader, eCFR files are plain XML (not ZIP archives).
 */

import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

/** Base URL for eCFR bulk XML on govinfo */
const ECFR_BULK_BASE = "https://www.govinfo.gov/bulkdata/ECFR";

/** Total number of CFR titles */
export const ECFR_TITLE_COUNT = 50;

/** All eCFR title numbers (1-50) */
export const ECFR_TITLE_NUMBERS = Array.from({ length: ECFR_TITLE_COUNT }, (_, i) => i + 1);

/** Titles that are reserved and have no bulk XML on govinfo */
const RESERVED_TITLES = new Set([35]);

/** Options for downloading eCFR titles */
export interface EcfrDownloadOptions {
  /** Download directory */
  output: string;
  /** Specific titles to download (1-50), or undefined for all */
  titles?: number[] | undefined;
}

/** Result of a successful download */
export interface EcfrDownloadResult {
  /** Number of titles successfully downloaded */
  titlesDownloaded: number;
  /** Paths of downloaded files */
  files: EcfrDownloadedFile[];
  /** Total bytes downloaded */
  totalBytes: number;
}

/** Metadata for a single downloaded file */
export interface EcfrDownloadedFile {
  /** Absolute path to the downloaded file */
  path: string;
  /** Title number */
  titleNumber: number;
  /** File size in bytes */
  size: number;
}

/** Error for a failed download */
export interface EcfrDownloadError {
  /** Title number that failed */
  titleNumber: number;
  /** HTTP status code or error message */
  error: string;
}

/**
 * Build the download URL for an eCFR title.
 */
export function buildEcfrDownloadUrl(titleNumber: number): string {
  return `${ECFR_BULK_BASE}/title-${titleNumber}/ECFR-title${titleNumber}.xml`;
}

/**
 * Download eCFR XML files from govinfo bulk data.
 */
export async function downloadEcfrTitles(
  options: EcfrDownloadOptions,
): Promise<EcfrDownloadResult> {
  const { output } = options;
  const titles = options.titles ?? ECFR_TITLE_NUMBERS;

  await mkdir(output, { recursive: true });
  const files: EcfrDownloadedFile[] = [];
  let totalBytes = 0;

  for (const titleNum of titles) {
    // Skip reserved titles (e.g., Title 35 — Panama Canal) that have no bulk XML
    if (RESERVED_TITLES.has(titleNum)) continue;

    const url = buildEcfrDownloadUrl(titleNum);
    const filePath = join(output, `ECFR-title${titleNum}.xml`);

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download eCFR Title ${titleNum}: ${response.status}`);
      continue;
    }

    const body = response.body;
    if (!body) continue;

    const dest = createWriteStream(filePath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pipeline(Readable.fromWeb(body as any), dest);

    const fileStat = await stat(filePath);
    const size = fileStat.size;
    totalBytes += size;

    files.push({ path: filePath, titleNumber: titleNum, size });
  }

  return { titlesDownloaded: files.length, files, totalBytes };
}
