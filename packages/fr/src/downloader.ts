/**
 * Federal Register API downloader.
 *
 * Downloads FR documents (XML + JSON metadata) from the FederalRegister.gov API.
 * The API provides per-document endpoints, rich JSON metadata, and requires no
 * authentication. Results are paginated (max 200/page) with a 10,000 result cap
 * per query — the downloader auto-chunks by month for large date ranges.
 *
 * API base: https://www.federalregister.gov/api/v1/
 */

import { createWriteStream } from "node:fs";
import { mkdir, stat, writeFile as fsWriteFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { buildFrDownloadXmlPath, buildFrDownloadJsonPath } from "./fr-path.js";
import type { FrDocumentJsonMeta } from "./fr-frontmatter.js";
import type { FrDocumentType } from "./fr-elements.js";

/** Base URL for the FederalRegister.gov API */
const FR_API_BASE = "https://www.federalregister.gov/api/v1";

/** Maximum results per page (API max) */
const PER_PAGE = 200;

/** Default number of concurrent XML downloads */
const DEFAULT_CONCURRENCY = 10;

/** Maximum retry attempts for transient errors */
const MAX_RETRIES = 2;

/** Base delay between retries (ms) */
const RETRY_BASE_DELAY_MS = 2000;

/** Fields to request from the API documents endpoint */
const API_FIELDS = [
  "document_number",
  "type",
  "title",
  "publication_date",
  "citation",
  "volume",
  "start_page",
  "end_page",
  "agencies",
  "cfr_references",
  "docket_ids",
  "regulation_id_numbers",
  "effective_on",
  "comments_close_on",
  "action",
  "abstract",
  "significant",
  "topics",
  "full_text_xml_url",
];

// ── Public types ──

/** Options for downloading FR documents */
export interface FrDownloadOptions {
  /** Download directory (e.g., "./downloads/fr") */
  output: string;
  /** Start date (YYYY-MM-DD, inclusive) */
  from: string;
  /** End date (YYYY-MM-DD, inclusive). Defaults to today. */
  to?: string | undefined;
  /** Document types to download. All types if omitted. */
  types?: FrDocumentType[] | undefined;
  /** Maximum number of documents to download (for testing) */
  limit?: number | undefined;
  /** Number of concurrent XML downloads (default 10) */
  concurrency?: number | undefined;
  /** Progress callback */
  onProgress?: ((progress: FrDownloadProgress) => void) | undefined;
}

/** Progress info for download callback */
export interface FrDownloadProgress {
  /** Documents downloaded so far */
  documentsDownloaded: number;
  /** Total documents found across all pages */
  totalDocuments: number;
  /** Current document number being downloaded */
  currentDocument: string;
  /** Current date chunk being processed (YYYY-MM) */
  currentChunk: string;
}

/** A successfully downloaded FR document */
export interface FrDownloadedFile {
  /** Absolute path to the XML file */
  xmlPath: string;
  /** Absolute path to the JSON metadata file */
  jsonPath: string;
  /** Document number */
  documentNumber: string;
  /** Publication date */
  publicationDate: string;
  /** Combined size in bytes (XML + JSON) */
  size: number;
}

/** A failed download */
export interface FrDownloadFailure {
  /** Document number */
  documentNumber: string;
  /** Error message */
  error: string;
}

/** Result of a download operation */
export interface FrDownloadResult {
  /** Number of documents downloaded */
  documentsDownloaded: number;
  /** Paths of downloaded files */
  files: FrDownloadedFile[];
  /** Total bytes downloaded */
  totalBytes: number;
  /** Date range covered */
  dateRange: { from: string; to: string };
  /** Documents without XML (pre-2000) */
  skipped: number;
  /** Documents that failed to download */
  failed: FrDownloadFailure[];
}

/** API listing response */
export interface FrApiListResponse {
  count: number;
  total_pages: number;
  next_page_url?: string | null;
  /** Can be absent on weekends/holidays when count is 0 */
  results?: FrDocumentJsonMeta[];
}

// ── Public functions ──

/**
 * Build the API documents listing URL for a date range.
 */
export function buildFrApiListUrl(from: string, to: string, page: number, types?: FrDocumentType[]): string {
  const params = new URLSearchParams();
  params.set("conditions[publication_date][gte]", from);
  params.set("conditions[publication_date][lte]", to);
  params.set("per_page", String(PER_PAGE));
  params.set("page", String(page));
  params.set("order", "oldest");

  for (const field of API_FIELDS) {
    params.append("fields[]", field);
  }

  if (types && types.length > 0) {
    for (const t of types) {
      params.append("conditions[type][]", t);
    }
  }

  return `${FR_API_BASE}/documents.json?${params.toString()}`;
}

/**
 * Download FR documents for a date range.
 *
 * Automatically chunks large date ranges into month-sized windows to stay
 * under the API's 10,000 result cap per query. Within each chunk, document
 * XML files are downloaded concurrently (default 10 at a time).
 */
export async function downloadFrDocuments(options: FrDownloadOptions): Promise<FrDownloadResult> {
  const to = options.to ?? new Date().toISOString().slice(0, 10);
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const files: FrDownloadedFile[] = [];
  const failed: FrDownloadFailure[] = [];
  let totalBytes = 0;
  let skipped = 0;
  let totalDocumentsFound = 0;

  // Break date range into month-sized chunks
  const chunks = buildMonthChunks(options.from, to);

  for (const chunk of chunks) {
    if (options.limit !== undefined && files.length >= options.limit) break;

    // Phase 1: Collect all document metadata for this chunk (pagination is fast, JSON only)
    const chunkDocs: FrDocumentJsonMeta[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const listUrl = buildFrApiListUrl(chunk.from, chunk.to, page, options.types);
      const response = await fetchWithRetry(listUrl);
      const data = (await response.json()) as FrApiListResponse;

      if (typeof data.count !== "number") {
        throw new Error(
          `Unexpected API response for ${listUrl}: missing or invalid 'count' field. ` +
            `The FederalRegister.gov API may have changed its response format.`,
        );
      }

      // Each chunk has its own count — accumulate on the first page of each chunk
      if (page === 1) {
        totalDocumentsFound += data.count;
      }

      const results = data.results ?? [];

      for (const doc of results) {
        if (!doc.full_text_xml_url) {
          skipped++;
          continue;
        }
        chunkDocs.push(doc);
      }

      hasMore = page < (data.total_pages ?? 0);
      page++;
    }

    // Apply limit to this chunk
    const remaining = options.limit !== undefined ? options.limit - files.length : chunkDocs.length;
    const docsToDownload = chunkDocs.slice(0, remaining);
    const chunkLabel = chunk.from.slice(0, 7);

    // Phase 2: Download XML files concurrently
    await downloadPool(docsToDownload, concurrency, options.output, (doc, result, error) => {
      if (result) {
        files.push(result);
        totalBytes += result.size;
      } else if (error) {
        failed.push({ documentNumber: doc.document_number, error });
      }
      options.onProgress?.({
        documentsDownloaded: files.length,
        totalDocuments: totalDocumentsFound,
        currentDocument: doc.document_number,
        currentChunk: chunkLabel,
      });
    });
  }

  return {
    documentsDownloaded: files.length,
    files,
    totalBytes,
    dateRange: { from: options.from, to },
    skipped,
    failed,
  };
}

/**
 * Download a single FR document by document number.
 *
 * Fetches both the JSON metadata and XML full text.
 */
export async function downloadSingleFrDocument(documentNumber: string, output: string): Promise<FrDownloadedFile> {
  // Fetch JSON metadata first to get publication date and XML URL
  const metaUrl = `${FR_API_BASE}/documents/${documentNumber}.json?${new URLSearchParams(API_FIELDS.map((f) => ["fields[]", f])).toString()}`;
  const metaResponse = await fetchWithRetry(metaUrl);
  const doc = (await metaResponse.json()) as FrDocumentJsonMeta;

  if (!doc.document_number || !doc.publication_date) {
    throw new Error(`Invalid API response for document ${documentNumber}: missing document_number or publication_date`);
  }

  return downloadSingleDocument(doc, output);
}

// ── Private helpers ──

/**
 * Download multiple documents concurrently using a worker pool.
 * Workers pull from a shared index, so concurrency is bounded without batching.
 */
async function downloadPool(
  docs: FrDocumentJsonMeta[],
  concurrency: number,
  outputDir: string,
  onComplete: (doc: FrDocumentJsonMeta, result: FrDownloadedFile | null, error: string | null) => void,
): Promise<void> {
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < docs.length) {
      const i = nextIndex++;
      const doc = docs[i];
      if (!doc) break;
      try {
        const result = await downloadSingleDocument(doc, outputDir);
        onComplete(doc, result, null);
      } catch (err) {
        onComplete(doc, null, err instanceof Error ? err.message : String(err));
      }
    }
  }

  const workerCount = Math.min(concurrency, docs.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

async function downloadSingleDocument(doc: FrDocumentJsonMeta, outputDir: string): Promise<FrDownloadedFile> {
  if (!doc.document_number || !doc.publication_date) {
    throw new Error(`Invalid document in API response: missing document_number or publication_date`);
  }
  if (!doc.full_text_xml_url) {
    throw new Error(`Document ${doc.document_number} has no full_text_xml_url — cannot download XML`);
  }

  const xmlPath = buildFrDownloadXmlPath(doc.document_number, doc.publication_date, outputDir);
  const jsonPath = buildFrDownloadJsonPath(doc.document_number, doc.publication_date, outputDir);

  // Ensure directory exists
  await mkdir(dirname(xmlPath), { recursive: true });

  // Write JSON metadata
  const jsonContent = JSON.stringify(doc, null, 2);
  await fsWriteFile(jsonPath, jsonContent, "utf-8");

  // Fetch and write XML
  const xmlResponse = await fetchWithRetry(doc.full_text_xml_url);
  if (!xmlResponse.body) {
    throw new Error(`No response body for ${doc.document_number} XML`);
  }

  const dest = createWriteStream(xmlPath);
  try {
    await pipeline(Readable.fromWeb(xmlResponse.body as never), dest);
  } catch (err) {
    throw new Error(
      `Failed to write XML for document ${doc.document_number} from ${doc.full_text_xml_url}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  // Get file sizes
  const xmlStat = await stat(xmlPath);
  const jsonSize = Buffer.byteLength(jsonContent, "utf-8");

  return {
    xmlPath,
    jsonPath,
    documentNumber: doc.document_number,
    publicationDate: doc.publication_date,
    size: Number(xmlStat.size) + jsonSize,
  };
}

/**
 * Break a date range into month-sized chunks.
 * Each chunk covers one calendar month (or partial month at boundaries).
 */
export function buildMonthChunks(from: string, to: string): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];

  let current = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");

  while (current <= end) {
    const chunkStart = current.toISOString().slice(0, 10);

    // End of this month
    const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
    const chunkEnd = monthEnd <= end ? monthEnd.toISOString().slice(0, 10) : to;

    chunks.push({ from: chunkStart, to: chunkEnd });

    // Move to first day of next month
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
  }

  return chunks;
}

/** Fetch with retry on transient HTTP and network errors */
export async function fetchWithRetry(url: string, attempt = 0): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    // Network-level error (DNS, TLS, connection reset) — retry
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `Network error for ${url}: ${err instanceof Error ? err.message : String(err)}. ` +
          `Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`,
      );
      await sleep(delay);
      return fetchWithRetry(url, attempt + 1);
    }
    throw new Error(
      `Network error after ${MAX_RETRIES + 1} attempts for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  if (response.ok) return response;

  // Retry on transient HTTP errors
  if ((response.status === 429 || response.status === 503 || response.status === 504) && attempt < MAX_RETRIES) {
    const retryAfter = response.headers.get("Retry-After");
    const parsedRetry = retryAfter ? parseInt(retryAfter, 10) : NaN;
    const delay =
      !isNaN(parsedRetry) && parsedRetry > 0 ? parsedRetry * 1000 : RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
    console.warn(
      `HTTP ${response.status} for ${url}. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`,
    );
    await sleep(delay);
    return fetchWithRetry(url, attempt + 1);
  }

  throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
