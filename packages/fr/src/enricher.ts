/**
 * Federal Register frontmatter enricher.
 *
 * Fetches rich JSON metadata from the FederalRegister.gov API listing endpoint
 * and patches frontmatter in existing converted Markdown files. This is used to
 * backfill metadata (agencies, CFR references, docket IDs, citations, etc.) into
 * files originally converted from govinfo bulk XML, which lacks this data.
 *
 * The enricher does NOT re-parse XML or re-render Markdown — it only updates the
 * YAML frontmatter block while preserving the body content exactly as-is.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse, stringify } from "yaml";
import { buildFrOutputPath } from "./fr-path.js";
import { buildFrApiListUrl, fetchWithRetry, buildMonthChunks } from "./downloader.js";
import type { FrApiListResponse } from "./downloader.js";
import type { FrDocumentJsonMeta } from "./fr-frontmatter.js";

// --- Public types ---

/** Options for enriching FR documents */
export interface EnrichFrOptions {
  /** Output root directory where .md files live (e.g., "./output") */
  output: string;
  /** Start date (YYYY-MM-DD, inclusive) */
  from: string;
  /** End date (YYYY-MM-DD, inclusive). Defaults to today. */
  to?: string | undefined;
  /** Overwrite files that are already enriched (have fr_citation) */
  force?: boolean | undefined;
  /** Progress callback */
  onProgress?: ((progress: EnrichFrProgress) => void) | undefined;
}

/** Progress info for enrichment callback */
export interface EnrichFrProgress {
  /** Documents whose frontmatter was updated */
  enriched: number;
  /** Documents skipped (already enriched or no frontmatter) */
  skipped: number;
  /** Documents in API but no .md file found locally */
  notFound: number;
  /** Total documents seen in API responses */
  total: number;
  /** Current month chunk being processed (YYYY-MM) */
  currentChunk: string;
  /** Current document number */
  currentDocument: string;
}

/** Result of an enrichment operation */
export interface EnrichFrResult {
  /** Documents whose frontmatter was updated */
  enriched: number;
  /** Documents skipped (already enriched or unparseable) */
  skipped: number;
  /** Documents in API but no .md file found locally */
  notFound: number;
  /** Total documents seen in API responses */
  total: number;
  /** Date range covered */
  dateRange: { from: string; to: string };
}

// --- Public function ---

/**
 * Enrich existing FR Markdown files with metadata from the FederalRegister.gov API.
 *
 * Paginates through the API listing endpoint (200 docs/page), matches each document
 * to its .md file by document number + publication date, and patches the YAML
 * frontmatter with enriched fields (citation, agencies, CFR references, etc.).
 */
export async function enrichFrDocuments(options: EnrichFrOptions): Promise<EnrichFrResult> {
  const to = options.to ?? new Date().toISOString().slice(0, 10);
  const force = options.force ?? false;

  let enriched = 0;
  let skipped = 0;
  let notFound = 0;
  let total = 0;

  const chunks = buildMonthChunks(options.from, to);

  for (const chunk of chunks) {
    let page = 1;
    let hasMore = true;
    const chunkLabel = chunk.from.slice(0, 7);

    while (hasMore) {
      const listUrl = buildFrApiListUrl(chunk.from, chunk.to, page);
      const response = await fetchWithRetry(listUrl);
      const data = (await response.json()) as FrApiListResponse;

      if (typeof data.count !== "number") {
        throw new Error(`Unexpected API response for ${listUrl}: missing or invalid 'count' field.`);
      }

      if (page === 1) {
        total += data.count;
      }

      const results = data.results ?? [];

      for (const doc of results) {
        if (!doc.document_number || !doc.publication_date) continue;

        const mdPath = buildFrOutputPath(doc.document_number, doc.publication_date, options.output);

        if (!existsSync(mdPath)) {
          notFound++;
          options.onProgress?.({
            enriched,
            skipped,
            notFound,
            total,
            currentChunk: chunkLabel,
            currentDocument: doc.document_number,
          });
          continue;
        }

        const content = await readFile(mdPath, "utf-8");

        // Split on frontmatter delimiters: ---\n...\n---\n
        const fmEnd = content.indexOf("\n---\n", 4);
        if (!content.startsWith("---\n") || fmEnd === -1) {
          skipped++;
          continue;
        }

        const yamlStr = content.slice(4, fmEnd);
        const body = content.slice(fmEnd + 5); // after "\n---\n"

        const fm = parse(yamlStr) as Record<string, unknown>;

        // Skip already-enriched files unless --force
        if (!force && fm["fr_citation"]) {
          skipped++;
          options.onProgress?.({
            enriched,
            skipped,
            notFound,
            total,
            currentChunk: chunkLabel,
            currentDocument: doc.document_number,
          });
          continue;
        }

        applyEnrichment(fm, doc);

        const newYaml = stringify(fm, {
          lineWidth: 0,
          defaultStringType: "QUOTE_DOUBLE",
          defaultKeyType: "PLAIN",
        });

        const newContent = `---\n${newYaml}---\n${body}`;
        await writeFile(mdPath, newContent, "utf-8");

        enriched++;
        options.onProgress?.({
          enriched,
          skipped,
          notFound,
          total,
          currentChunk: chunkLabel,
          currentDocument: doc.document_number,
        });
      }

      hasMore = page < (data.total_pages ?? 0);
      page++;
    }
  }

  return { enriched, skipped, notFound, total, dateRange: { from: options.from, to } };
}

// --- Private helpers ---

/** Normalize API document type to lowercase snake_case */
function normalizeDocumentType(apiType: string): string {
  const map: Record<string, string> = {
    Rule: "rule",
    "Proposed Rule": "proposed_rule",
    Notice: "notice",
    "Presidential Document": "presidential_document",
  };
  return map[apiType] ?? apiType.toLowerCase().replace(/\s+/g, "_");
}

/** Merge API metadata fields into an existing frontmatter object */
function applyEnrichment(fm: Record<string, unknown>, doc: FrDocumentJsonMeta): void {
  if (doc.type) {
    fm["document_type"] = normalizeDocumentType(doc.type);
  }

  if (doc.citation) {
    fm["fr_citation"] = doc.citation;
  }

  if (doc.volume) {
    fm["fr_volume"] = doc.volume;
  }

  if (doc.publication_date) {
    fm["publication_date"] = doc.publication_date;
    fm["currency"] = doc.publication_date;
    fm["last_updated"] = doc.publication_date;
  }

  if (doc.agencies && doc.agencies.length > 0) {
    const [primary] = doc.agencies;
    if (primary) fm["agency"] = primary.name;
    fm["agencies"] = doc.agencies.map((a) => a.name);
  }

  if (doc.cfr_references && doc.cfr_references.length > 0) {
    fm["cfr_references"] = doc.cfr_references.map((r) => `${r.title} CFR Part ${r.part}`);
  }

  if (doc.docket_ids && doc.docket_ids.length > 0) {
    fm["docket_ids"] = doc.docket_ids;
  }

  if (doc.regulation_id_numbers && doc.regulation_id_numbers.length > 0) {
    fm["rin"] = doc.regulation_id_numbers[0];
  }

  if (doc.effective_on) {
    fm["effective_date"] = doc.effective_on;
  }

  if (doc.comments_close_on) {
    fm["comments_close_date"] = doc.comments_close_on;
  }

  if (doc.action) {
    fm["fr_action"] = doc.action;
  }

  // Update title from API if available (often more descriptive than XML subject)
  if (doc.title) {
    fm["title"] = doc.title;
    fm["section_name"] = doc.title;
  }
}
