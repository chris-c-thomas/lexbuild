/**
 * eCFR API downloader.
 *
 * Downloads individual title XML files from the ecfr.gov versioner API.
 * Unlike the govinfo bulk downloader, this source provides daily-updated,
 * point-in-time data and supports fetching the CFR as of any specific date.
 *
 * API base: https://www.ecfr.gov/api/versioner/v1/
 */

import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ECFR_TITLE_NUMBERS } from "./downloader.js";

/** Base URL for the eCFR versioner API */
const ECFR_API_BASE = "https://www.ecfr.gov/api/versioner/v1";

/** Titles that are reserved and return 404 from the API */
const RESERVED_TITLES = new Set([35]);

// ---------------------------------------------------------------------------
// Title metadata
// ---------------------------------------------------------------------------

/** Metadata for a single CFR title from the eCFR API */
export interface EcfrTitleMeta {
  /** Title number (1-50) */
  number: number;
  /** Title name */
  name: string;
  /** Date of the most recent amendment */
  latestAmendedOn: string;
  /** Date of the most recent Federal Register issue incorporated */
  latestIssueDate: string;
  /** Currency date — how current the data is */
  upToDateAsOf: string;
  /** Whether this title is reserved (e.g., Title 35) */
  reserved: boolean;
}

/** Response from the /titles endpoint */
export interface EcfrTitlesResponse {
  /** Currency date for the dataset */
  date: string;
  /** Whether a data import is currently in progress */
  importInProgress: boolean;
  /** Per-title metadata */
  titles: EcfrTitleMeta[];
}

/**
 * Fetch metadata for all CFR titles from the eCFR API.
 *
 * Returns currency dates and amendment info for each title.
 * Useful for staleness detection without downloading XML.
 */
export async function fetchEcfrTitlesMeta(): Promise<EcfrTitlesResponse> {
  const response = await fetch(`${ECFR_API_BASE}/titles`);
  if (!response.ok) {
    throw new Error(`Failed to fetch eCFR titles metadata: HTTP ${response.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API JSON shape
  const data = (await response.json()) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API JSON shape
  const titles: EcfrTitleMeta[] = data.titles.map((t: any) => ({
    number: t.number,
    name: t.name,
    latestAmendedOn: t.latest_amended_on,
    latestIssueDate: t.latest_issue_date,
    upToDateAsOf: t.up_to_date_as_of,
    reserved: t.reserved,
  }));

  return {
    date: data.meta.date,
    importInProgress: data.meta.import_in_progress,
    titles,
  };
}

// ---------------------------------------------------------------------------
// Download options and result types
// ---------------------------------------------------------------------------

/** Options for downloading eCFR titles from the API */
export interface EcfrApiDownloadOptions {
  /** Download directory */
  output: string;
  /** Specific titles to download (1-50), or undefined for all */
  titles?: number[] | undefined;
  /** Point-in-time date (YYYY-MM-DD). Defaults to the current currency date. */
  date?: string | undefined;
}

/** Result of a download from the eCFR API */
export interface EcfrApiDownloadResult {
  /** Number of titles successfully downloaded */
  titlesDownloaded: number;
  /** Paths of downloaded files */
  files: EcfrApiDownloadedFile[];
  /** Total bytes downloaded */
  totalBytes: number;
  /** The date used for point-in-time downloads */
  asOfDate: string;
}

/** Metadata for a single downloaded file from the eCFR API */
export interface EcfrApiDownloadedFile {
  /** Absolute path to the downloaded file */
  path: string;
  /** Title number */
  titleNumber: number;
  /** File size in bytes */
  size: number;
  /** The point-in-time date used */
  asOfDate: string;
}

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

/**
 * Build the download URL for a full title XML from the eCFR API.
 *
 * @param titleNumber - CFR title number (1-50)
 * @param date - Point-in-time date in YYYY-MM-DD format
 */
export function buildEcfrApiDownloadUrl(titleNumber: number, date: string): string {
  return `${ECFR_API_BASE}/full/${date}/title-${titleNumber}.xml`;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Download eCFR XML files from the ecfr.gov versioner API.
 *
 * When no date is specified, fetches the current currency date from the
 * /titles endpoint and uses that for all downloads.
 */
export async function downloadEcfrTitlesFromApi(
  options: EcfrApiDownloadOptions,
): Promise<EcfrApiDownloadResult> {
  const { output } = options;
  const titles = options.titles ?? ECFR_TITLE_NUMBERS;

  // Resolve the date to use
  let asOfDate = options.date;
  if (!asOfDate) {
    const meta = await fetchEcfrTitlesMeta();
    if (meta.importInProgress) {
      // When an import is in progress, the advertised meta.date may return 404.
      // Fall back to the previous day which should be fully available.
      const prev = new Date(meta.date);
      prev.setDate(prev.getDate() - 1);
      asOfDate = prev.toISOString().slice(0, 10);
    } else {
      asOfDate = meta.date;
    }
  }

  await mkdir(output, { recursive: true });
  const files: EcfrApiDownloadedFile[] = [];
  let totalBytes = 0;

  for (const titleNum of titles) {
    // Skip reserved titles (e.g., Title 35 — Panama Canal)
    if (RESERVED_TITLES.has(titleNum)) continue;

    const url = buildEcfrApiDownloadUrl(titleNum, asOfDate);
    // Use the same filename as govinfo downloads for converter compatibility
    const filePath = join(output, `ECFR-title${titleNum}.xml`);

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download eCFR Title ${titleNum} from API: ${response.status}`);
      continue;
    }

    const body = response.body;
    if (!body) continue;

    const dest = createWriteStream(filePath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ReadableStream type bridge
    await pipeline(Readable.fromWeb(body as any), dest);

    const fileStat = await stat(filePath);
    const size = fileStat.size;
    totalBytes += size;

    files.push({ path: filePath, titleNumber: titleNum, size, asOfDate });
  }

  return { titlesDownloaded: files.length, files, totalBytes, asOfDate };
}
