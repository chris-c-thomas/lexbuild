/**
 * OLRC release point detection.
 *
 * Scrapes the OLRC download page to detect the latest release point,
 * eliminating the need to hardcode release point identifiers.
 */

/** OLRC download page URL */
const OLRC_DOWNLOAD_PAGE = "https://uscode.house.gov/download/download.shtml";

/** OLRC prior release points page URL */
const OLRC_PRIOR_RELEASES_PAGE = "https://uscode.house.gov/download/priorreleasepoints.htm";

/** Detected release point information */
export interface ReleasePointInfo {
  /** Release point identifier (e.g., "119-73not60") */
  releasePoint: string;
  /** Human-readable description (e.g., "Public Law 119-73 (01/23/2026) , except 119-60") */
  description: string;
}

/** Historical release point from the prior release points page */
export interface HistoricalReleasePointInfo {
  /** Release point identifier (e.g., "119-72not60") */
  releasePoint: string;
  /** Human-readable description (e.g., "Public Law 119-72 (01/20/2026), except 119-60, affecting titles 38, 42.") */
  description: string;
  /** Date string from the description (e.g., "01/20/2026"), or empty if not found */
  date: string;
  /** Title numbers affected by this release point, or empty array if not listed */
  affectedTitles: number[];
}

/**
 * Detect the latest OLRC release point by scraping the download page.
 *
 * Uses two extraction strategies for redundancy:
 * 1. Parse the release point from download URL hrefs (most reliable)
 * 2. Fall back to parsing the release point info heading
 *
 * Returns `null` if the page cannot be fetched or parsed.
 */
export async function detectLatestReleasePoint(): Promise<ReleasePointInfo | null> {
  let html: string;
  try {
    const response = await fetch(OLRC_DOWNLOAD_PAGE);
    if (!response.ok) return null;
    html = await response.text();
  } catch {
    return null;
  }

  return parseReleasePointFromHtml(html);
}

/**
 * Parse the release point from OLRC download page HTML.
 *
 * Exported for testing — prefer `detectLatestReleasePoint()` for production use.
 */
export function parseReleasePointFromHtml(html: string): ReleasePointInfo | null {
  // Strategy 1: Extract from download URL hrefs
  // Links look like: href="...xml_uscAll@119-73not60.zip"
  const urlMatch = /xml_uscAll@([\w-]+)\.zip/.exec(html);
  if (urlMatch?.[1]) {
    const releasePoint = urlMatch[1];
    const description = parseDescription(html);
    return { releasePoint, description };
  }

  // Strategy 2: Extract from any single-title download URL
  // Links look like: href="...xml_usc01@119-73not60.zip"
  const singleUrlMatch = /xml_usc\d{2}@([\w-]+)\.zip/.exec(html);
  if (singleUrlMatch?.[1]) {
    const releasePoint = singleUrlMatch[1];
    const description = parseDescription(html);
    return { releasePoint, description };
  }

  return null;
}

/**
 * Parse the human-readable description from the release point heading.
 *
 * Uses indexOf-based extraction (not regex) to avoid polynomial backtracking
 * on untrusted HTML input.
 *
 * The heading looks like:
 * `<h3 class="releasepointinformation">Public Law 119-73 (01/23/2026) , except 119-60</h3>`
 */
function parseDescription(html: string): string {
  const marker = 'class="releasepointinformation">';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return "";
  const contentStart = startIdx + marker.length;
  const endIdx = html.indexOf("</h3>", contentStart);
  if (endIdx === -1) return "";
  return html.slice(contentStart, endIdx).trim();
}

// --- Release point history ---

/**
 * Fetch the full history of prior release points from OLRC.
 *
 * Scrapes `https://uscode.house.gov/download/priorreleasepoints.htm` and
 * returns an array of historical release points ordered newest-first
 * (matching the page order). Parsing is best-effort — malformed entries
 * are skipped and valid entries are still returned.
 *
 * Returns an empty array if the page cannot be fetched.
 */
export async function fetchReleasePointHistory(): Promise<HistoricalReleasePointInfo[]> {
  let html: string;
  try {
    const response = await fetch(OLRC_PRIOR_RELEASES_PAGE);
    if (!response.ok) return [];
    html = await response.text();
  } catch {
    return [];
  }

  return parseReleasePointHistoryFromHtml(html);
}

/**
 * Parse historical release points from the OLRC prior release points page HTML.
 *
 * The page contains a `<ul class="releasepoints">` with `<li>` entries like:
 * ```html
 * <li class="releasepoint">
 *   <a class="releasepoint" href="releasepoints/us/pl/119/72not60/usc-rp@119-72not60.htm">
 *     Public Law 119-72 (01/20/2026), except 119-60, affecting titles 38, 42.
 *   </a>
 * </li>
 * ```
 *
 * Exported for testing — prefer `fetchReleasePointHistory()` for production use.
 */
export function parseReleasePointHistoryFromHtml(html: string): HistoricalReleasePointInfo[] {
  const results: HistoricalReleasePointInfo[] = [];

  // Match all release point links by their href pattern: usc-rp@{id}.htm
  // Use indexOf-based iteration to avoid catastrophic backtracking on large pages.
  const hrefMarker = "usc-rp@";
  let searchStart = 0;

  while (searchStart < html.length) {
    const hrefIdx = html.indexOf(hrefMarker, searchStart);
    if (hrefIdx === -1) break;

    // Extract the release point ID: everything between "usc-rp@" and ".htm"
    const idStart = hrefIdx + hrefMarker.length;
    const htmIdx = html.indexOf(".htm", idStart);
    if (htmIdx === -1) {
      searchStart = hrefIdx + hrefMarker.length;
      continue;
    }
    const releasePoint = html.slice(idStart, htmIdx);

    // Find the closing </a> tag to extract the description text
    const anchorCloseIdx = html.indexOf("</a>", htmIdx);
    if (anchorCloseIdx === -1) {
      searchStart = hrefIdx + hrefMarker.length;
      continue;
    }

    // Find the ">" that ends the opening <a> tag (search forward from href)
    const tagCloseIdx = html.indexOf(">", htmIdx);
    if (tagCloseIdx === -1 || tagCloseIdx >= anchorCloseIdx) {
      searchStart = hrefIdx + hrefMarker.length;
      continue;
    }

    const description = html
      .slice(tagCloseIdx + 1, anchorCloseIdx)
      .replace(/\s+/g, " ")
      .trim();

    // Extract date: (MM/DD/YYYY)
    const dateMatch = /\((\d{2}\/\d{2}\/\d{4})\)/.exec(description);
    const date = dateMatch?.[1] ?? "";

    // Extract affected titles: "affecting title(s) N, N, N."
    const affectedTitles = parseAffectedTitles(description);

    results.push({ releasePoint, description, date, affectedTitles });

    searchStart = anchorCloseIdx + 4; // past "</a>"
  }

  return results;
}

/**
 * Parse affected title numbers from a release point description.
 *
 * Handles both "affecting title 42." (singular) and
 * "affecting titles 38, 42." (plural).
 */
function parseAffectedTitles(description: string): number[] {
  const match = /affecting titles?\s+([\d,\s]+)/.exec(description);
  if (!match?.[1]) return [];

  return match[1]
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}
