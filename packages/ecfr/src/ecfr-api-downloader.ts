/**
 * eCFR API downloader.
 *
 * Downloads individual title XML files from the ecfr.gov versioner API.
 * Unlike the govinfo bulk downloader, this source provides daily-updated,
 * point-in-time data and supports fetching the CFR as of any specific date.
 *
 * Uses per-title currency dates from the /titles metadata endpoint to ensure
 * every title downloads successfully, even when individual titles are being
 * processed or the global import is in progress.
 *
 * API base: https://www.ecfr.gov/api/versioner/v1/
 */

import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ECFR_TITLE_NUMBERS, type EcfrDownloadProgress } from "./downloader.js";

/** Base URL for the eCFR versioner API */
const ECFR_API_BASE = "https://www.ecfr.gov/api/versioner/v1";

/** Titles that are reserved and return 404 from the API */
const RESERVED_TITLES = new Set([35]);

/** Maximum retry attempts for transient errors (503, 504) */
const MAX_RETRIES = 2;

/** Base delay between retries in milliseconds */
const RETRY_BASE_DELAY_MS = 3000;

// --- Title metadata ---

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
  /** Whether this title is currently being processed */
  processingInProgress: boolean;
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
    processingInProgress: t.processing_in_progress ?? false,
  }));

  return {
    date: data.meta.date,
    importInProgress: data.meta.import_in_progress,
    titles,
  };
}

// --- Download options and result types ---

/** Options for downloading eCFR titles from the API */
export interface EcfrApiDownloadOptions {
  /** Download directory */
  output: string;
  /** Specific titles to download (1-50), or undefined for all */
  titles?: number[] | undefined;
  /** Point-in-time date (YYYY-MM-DD). Defaults to per-title currency dates. */
  date?: string | undefined;
  /** Pre-fetched title metadata (avoids a second /titles call) */
  titlesMeta?: EcfrTitlesResponse | undefined;
  /** Progress callback invoked before each title download */
  onProgress?: ((progress: EcfrDownloadProgress) => void) | undefined;
}

/** Result of a download from the eCFR API */
export interface EcfrApiDownloadResult {
  /** Number of titles successfully downloaded */
  titlesDownloaded: number;
  /** Paths of downloaded files */
  files: EcfrApiDownloadedFile[];
  /** Total bytes downloaded */
  totalBytes: number;
  /** The primary date used (most common across titles) */
  asOfDate: string;
  /** Titles that failed after retries */
  failed: EcfrDownloadFailure[];
}

/** Metadata for a single downloaded file from the eCFR API */
export interface EcfrApiDownloadedFile {
  /** Absolute path to the downloaded file */
  path: string;
  /** Title number */
  titleNumber: number;
  /** File size in bytes */
  size: number;
  /** The point-in-time date used for this title */
  asOfDate: string;
}

/** A title that failed to download */
interface EcfrDownloadFailure {
  /** Title number */
  titleNumber: number;
  /** HTTP status code of the final attempt */
  status: number;
  /** The date that was attempted */
  dateAttempted: string;
}

// --- URL construction ---

/**
 * Build the download URL for a full title XML from the eCFR API.
 *
 * @param titleNumber - CFR title number (1-50)
 * @param date - Point-in-time date in YYYY-MM-DD format
 */
export function buildEcfrApiDownloadUrl(titleNumber: number, date: string): string {
  return `${ECFR_API_BASE}/full/${date}/title-${titleNumber}.xml`;
}

// --- Download ---

/**
 * Download eCFR XML files from the ecfr.gov versioner API.
 *
 * Uses per-title currency dates from the /titles metadata to ensure every
 * title downloads successfully. Titles that are being processed get their
 * individual `up_to_date_as_of` date instead of the global date.
 *
 * Retries transient errors (503, 504) up to MAX_RETRIES times with
 * exponential backoff.
 */
export async function downloadEcfrTitlesFromApi(
  options: EcfrApiDownloadOptions,
): Promise<EcfrApiDownloadResult> {
  const { output, onProgress } = options;
  const titles = options.titles ?? ECFR_TITLE_NUMBERS;

  // Fetch metadata (or use pre-fetched)
  const meta = options.titlesMeta ?? (await fetchEcfrTitlesMeta());

  // Build a map of title number → best available date
  const titleDateMap = new Map<number, string>();

  if (options.date) {
    // Explicit date: use it for all titles
    for (const num of titles) {
      titleDateMap.set(num, options.date);
    }
  } else {
    // Auto-detect: use each title's up_to_date_as_of for the most reliable date
    const globalDate = meta.importInProgress
      ? (() => {
          const prev = new Date(meta.date);
          prev.setDate(prev.getDate() - 1);
          return prev.toISOString().slice(0, 10);
        })()
      : meta.date;

    for (const num of titles) {
      const titleMeta = meta.titles.find((t) => t.number === num);
      if (titleMeta?.processingInProgress && titleMeta.upToDateAsOf) {
        // Title is being processed — use its individual currency date
        titleDateMap.set(num, titleMeta.upToDateAsOf);
      } else if (titleMeta?.upToDateAsOf) {
        // Use the title's own date if available, falling back to global
        titleDateMap.set(
          num,
          titleMeta.upToDateAsOf < globalDate ? titleMeta.upToDateAsOf : globalDate,
        );
      } else {
        titleDateMap.set(num, globalDate);
      }
    }
  }

  await mkdir(output, { recursive: true });
  const files: EcfrApiDownloadedFile[] = [];
  const failed: EcfrDownloadFailure[] = [];
  let totalBytes = 0;
  const downloadable = titles.filter((t) => !RESERVED_TITLES.has(t));

  for (const [i, titleNum] of downloadable.entries()) {
    onProgress?.({ current: i + 1, total: downloadable.length, titleNumber: titleNum });

    const titleDate = titleDateMap.get(titleNum) ?? meta.date;
    const filePath = join(output, `ECFR-title${titleNum}.xml`);

    const result = await downloadWithRetry(titleNum, titleDate, filePath);
    if (result.ok) {
      totalBytes += result.size;
      files.push({ path: filePath, titleNumber: titleNum, size: result.size, asOfDate: titleDate });
    } else {
      failed.push({ titleNumber: titleNum, status: result.status, dateAttempted: titleDate });
    }
  }

  // Determine the primary date (most common across downloaded files)
  const dateCounts = new Map<string, number>();
  for (const file of files) {
    dateCounts.set(file.asOfDate, (dateCounts.get(file.asOfDate) ?? 0) + 1);
  }
  const primaryDate =
    options.date ?? [...dateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? meta.date;

  return { titlesDownloaded: files.length, files, totalBytes, asOfDate: primaryDate, failed };
}

/** Download a single title with retry on transient and network errors */
async function downloadWithRetry(
  titleNum: number,
  date: string,
  filePath: string,
): Promise<{ ok: true; size: number } | { ok: false; status: number }> {
  const url = buildEcfrApiDownloadUrl(titleNum, date);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        const body = response.body;
        if (!body) return { ok: false, status: 0 };

        const dest = createWriteStream(filePath);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ReadableStream type bridge
        await pipeline(Readable.fromWeb(body as any), dest);

        const fileStat = await stat(filePath);
        return { ok: true, size: fileStat.size };
      }

      // Retry on transient HTTP errors (503 Service Unavailable, 504 Gateway Timeout)
      if ((response.status === 503 || response.status === 504) && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable HTTP error or retries exhausted
      return { ok: false, status: response.status };
    } catch {
      // Network-level error (DNS, TLS, connection reset) — retry
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return { ok: false, status: 0 };
    }
  }

  return { ok: false, status: 0 };
}
