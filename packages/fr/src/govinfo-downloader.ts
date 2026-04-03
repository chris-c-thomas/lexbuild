/**
 * Federal Register govinfo bulk downloader.
 *
 * Downloads complete daily-issue XML files from govinfo.gov. Each file contains
 * all FR documents published on a single day (~150 documents, ~2.4 MB average).
 * This is dramatically faster than the per-document API for historical backfill.
 *
 * URL pattern: https://www.govinfo.gov/content/pkg/FR-{YYYY-MM-DD}/xml/FR-{YYYY-MM-DD}.xml
 *
 * The existing FrASTBuilder handles daily-issue XML natively: FEDREG root is a
 * passthrough, section containers (RULES, NOTICES, etc.) are passthroughs, and
 * individual document elements emit via onEmit. No splitter needed.
 */

import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

/** Base URL for govinfo FR bulk data */
const GOVINFO_BASE = "https://www.govinfo.gov/content/pkg";

/** Default number of concurrent downloads */
const DEFAULT_CONCURRENCY = 10;

/** Maximum retry attempts for transient errors */
const MAX_RETRIES = 2;

/** Base delay between retries (ms) */
const RETRY_BASE_DELAY_MS = 2000;

// ── Public types ──

/** Options for downloading FR bulk XML from govinfo */
export interface FrGovinfoBulkOptions {
  /** Download directory (e.g., "./downloads/fr") */
  output: string;
  /** Start date (YYYY-MM-DD, inclusive) */
  from: string;
  /** End date (YYYY-MM-DD, inclusive). Defaults to today. */
  to?: string | undefined;
  /** Number of concurrent downloads (default 10) */
  concurrency?: number | undefined;
  /** Progress callback */
  onProgress?: ((progress: FrGovinfoProgress) => void) | undefined;
}

/** Progress info for govinfo download callback */
export interface FrGovinfoProgress {
  /** Files downloaded so far */
  downloaded: number;
  /** Total publishing days in date range */
  totalDays: number;
  /** Skipped days (weekends/holidays — 404) */
  skipped: number;
  /** Failed downloads */
  failed: number;
  /** Current date being downloaded */
  currentDate: string;
}

/** A successfully downloaded bulk file */
export interface FrGovinfoDownloadedFile {
  /** Absolute path to the downloaded XML file */
  path: string;
  /** Publication date (YYYY-MM-DD) */
  date: string;
  /** File size in bytes */
  size: number;
}

/** Result of a govinfo bulk download */
export interface FrGovinfoResult {
  /** Number of daily files downloaded */
  filesDownloaded: number;
  /** Downloaded files */
  files: FrGovinfoDownloadedFile[];
  /** Total bytes downloaded */
  totalBytes: number;
  /** Date range covered */
  dateRange: { from: string; to: string };
  /** Days skipped (no issue published — weekends/holidays) */
  skipped: number;
  /** Days that failed to download */
  failed: number;
}

// ── Public functions ──

/**
 * Build the govinfo download URL for a single day's FR issue.
 */
export function buildGovinfoFrUrl(date: string): string {
  return `${GOVINFO_BASE}/FR-${date}/xml/FR-${date}.xml`;
}

/**
 * Build the local file path for a downloaded daily-issue XML.
 * Stored as: {output}/bulk/{YYYY}/FR-{YYYY-MM-DD}.xml
 */
export function buildGovinfoBulkPath(date: string, outputDir: string): string {
  const year = date.slice(0, 4);
  return join(outputDir, "bulk", year, `FR-${date}.xml`);
}

/**
 * Download FR daily-issue XML files from govinfo for a date range.
 * Skips weekends/holidays (404 responses) and retries transient errors.
 */
export async function downloadFrBulk(options: FrGovinfoBulkOptions): Promise<FrGovinfoResult> {
  const to = options.to ?? new Date().toISOString().slice(0, 10);
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  // Generate all dates in range
  const dates = generateDateRange(options.from, to);

  const files: FrGovinfoDownloadedFile[] = [];
  let totalBytes = 0;
  let skipped = 0;
  let failed = 0;

  // Download concurrently using a worker pool
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < dates.length) {
      const i = nextIndex++;
      const date = dates[i];
      if (!date) break;

      options.onProgress?.({
        downloaded: files.length,
        totalDays: dates.length,
        skipped,
        failed,
        currentDate: date,
      });

      const url = buildGovinfoFrUrl(date);
      const filePath = buildGovinfoBulkPath(date, options.output);

      try {
        const result = await downloadSingleDay(url, filePath, date);
        if (result) {
          files.push(result);
          totalBytes += result.size;
        } else {
          // null means 404 — no issue published on this date
          skipped++;
        }
      } catch (err) {
        console.warn(`Warning: Failed to download ${date}: ${err instanceof Error ? err.message : String(err)}`);
        failed++;
      }
    }
  }

  const workerCount = Math.min(concurrency, dates.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  // Final progress update
  options.onProgress?.({
    downloaded: files.length,
    totalDays: dates.length,
    skipped,
    failed,
    currentDate: "done",
  });

  return {
    filesDownloaded: files.length,
    files,
    totalBytes,
    dateRange: { from: options.from, to },
    skipped,
    failed,
  };
}

// ── Private helpers ──

/**
 * Download a single day's FR issue XML. Returns null if 404 (no issue).
 */
async function downloadSingleDay(url: string, filePath: string, date: string): Promise<FrGovinfoDownloadedFile | null> {
  const response = await fetchWithRetry(url);

  if (response.status === 404) {
    return null; // No issue published on this date (weekend/holiday)
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  if (!response.body) {
    throw new Error(`No response body for ${url}`);
  }

  await mkdir(dirname(filePath), { recursive: true });

  const dest = createWriteStream(filePath);
  await pipeline(Readable.fromWeb(response.body as never), dest);

  const fileStat = await stat(filePath);

  return {
    path: filePath,
    date,
    size: Number(fileStat.size),
  };
}

/**
 * Generate all dates (YYYY-MM-DD) in a range, inclusive.
 */
function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from + "T12:00:00Z"); // Noon UTC to avoid DST issues
  const end = new Date(to + "T12:00:00Z");

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/** Fetch with retry on transient HTTP and network errors */
async function fetchWithRetry(url: string, attempt = 0): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await sleep(delay);
      return fetchWithRetry(url, attempt + 1);
    }
    throw new Error(
      `Network error after ${MAX_RETRIES + 1} attempts for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  if (response.ok || response.status === 404) return response;

  if ((response.status === 429 || response.status === 503 || response.status === 504) && attempt < MAX_RETRIES) {
    const retryAfter = response.headers.get("Retry-After");
    const parsedRetry = retryAfter ? parseInt(retryAfter, 10) : NaN;
    const delay =
      !isNaN(parsedRetry) && parsedRetry > 0 ? parsedRetry * 1000 : RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
    await sleep(delay);
    return fetchWithRetry(url, attempt + 1);
  }

  throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
