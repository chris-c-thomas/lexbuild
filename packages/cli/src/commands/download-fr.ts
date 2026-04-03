/**
 * `lexbuild download-fr` command — downloads Federal Register XML + JSON.
 *
 * Supports two sources:
 *   - `fr-api` (default): Per-document XML + JSON metadata from FederalRegister.gov API
 *   - `govinfo`: Bulk daily-issue XML from govinfo.gov (faster for historical backfill)
 */

import { Command } from "commander";
import { relative, resolve } from "node:path";
import { downloadFrDocuments, downloadSingleFrDocument, downloadFrBulk } from "@lexbuild/fr";
import type { FrDocumentType } from "@lexbuild/fr";
import { createSpinner, summaryBlock, formatDuration, formatBytes, formatNumber, error } from "../ui.js";

/** Valid document type values for --types flag */
const VALID_TYPES = new Map<string, FrDocumentType>([
  ["rule", "RULE"],
  ["proposed_rule", "PRORULE"],
  ["notice", "NOTICE"],
  ["presidential_document", "PRESDOCU"],
]);

/** Parsed options from the download-fr command */
interface DownloadFrOptions {
  output: string;
  source: string;
  from?: string | undefined;
  to?: string | undefined;
  types?: string | undefined;
  recent?: string | undefined;
  document?: string | undefined;
  limit?: string | undefined;
  concurrency?: string | undefined;
}

export const downloadFrCommand = new Command("download-fr")
  .description("Download Federal Register XML and metadata")
  .option("-o, --output <dir>", "Download directory", "./downloads/fr")
  .option("--source <source>", "Source: fr-api (default, per-document) or govinfo (bulk daily)", "fr-api")
  .option("--from <YYYY-MM-DD>", "Start date (inclusive)")
  .option("--to <YYYY-MM-DD>", "End date (inclusive, defaults to today)")
  .option("--types <types>", "Document types: rule, proposed_rule, notice, presidential_document (fr-api only)")
  .option("--recent <days>", "Download last N days")
  .option("--document <number>", "Download a single document by number (fr-api only)")
  .option("--limit <n>", "Maximum number of documents (fr-api only)")
  .option("--concurrency <n>", "Concurrent downloads (default: 10)")
  .addHelpText(
    "after",
    `
Examples:
  $ lexbuild download-fr --from 2026-01-01 --to 2026-03-31
  $ lexbuild download-fr --from 2026-01-01 --types rule,proposed_rule
  $ lexbuild download-fr --recent 30
  $ lexbuild download-fr --document 2026-06029
  $ lexbuild download-fr --source govinfo --from 2000-01-01 --to 2025-12-31

Sources:
  fr-api (default)   Per-document XML + JSON from FederalRegister.gov API
  govinfo            Bulk daily-issue XML from govinfo.gov (faster for backfill)

Document types (fr-api only):
  rule                    Final rules
  proposed_rule           Proposed rules (NPRMs)
  notice                  Notices
  presidential_document   Executive orders, memoranda, proclamations`,
  )
  .action(async (options: DownloadFrOptions) => {
    // Validate source
    if (options.source !== "fr-api" && options.source !== "govinfo") {
      console.error(error(`Invalid source "${options.source}". Use "fr-api" (default) or "govinfo".`));
      process.exit(1);
    }

    // Validate: need --from, --recent, or --document
    if (!options.from && !options.recent && !options.document) {
      console.error(
        error(
          "Specify --from <date>, --recent <days>, or --document <number>\n" +
            "Examples: --from 2026-01-01, --recent 30, --document 2026-06029",
        ),
      );
      process.exit(1);
    }

    // Validate date format
    if (options.from && !/^\d{4}-\d{2}-\d{2}$/.test(options.from)) {
      console.error(error("--from must be in YYYY-MM-DD format"));
      process.exit(1);
    }
    if (options.to && !/^\d{4}-\d{2}-\d{2}$/.test(options.to)) {
      console.error(error("--to must be in YYYY-MM-DD format"));
      process.exit(1);
    }

    const outputDir = resolve(options.output);
    const startTime = performance.now();

    // Parse concurrency
    let concurrency: number | undefined;
    if (options.concurrency) {
      concurrency = parseInt(options.concurrency, 10);
      if (isNaN(concurrency) || concurrency <= 0) {
        console.error(error("--concurrency must be a positive integer"));
        process.exit(1);
      }
    }

    // ── Govinfo bulk mode ──
    if (options.source === "govinfo") {
      await downloadGovinfo(options, outputDir, startTime, concurrency);
      return;
    }

    // ── FR API: Single document mode ──
    if (options.document) {
      const spinner = createSpinner(`Downloading FR document ${options.document}`);
      try {
        const file = await downloadSingleFrDocument(options.document, outputDir);
        spinner.succeed(`Downloaded FR document ${options.document}`);
        console.log();
        console.log(
          summaryBlock({
            title: "Download Complete",
            rows: [
              ["Document", file.documentNumber],
              ["Date", file.publicationDate],
              ["Size", formatBytes(file.size)],
              ["XML", relative(process.cwd(), file.xmlPath)],
              ["JSON", relative(process.cwd(), file.jsonPath)],
            ],
          }),
        );
      } catch (err) {
        spinner.fail(`Failed to download ${options.document}`);
        console.error(error(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
      return;
    }

    // ── FR API: Date range mode ──
    await downloadFrApi(options, outputDir, startTime, concurrency);
  });

// ── Govinfo bulk download ──

async function downloadGovinfo(
  options: DownloadFrOptions,
  outputDir: string,
  startTime: number,
  concurrency: number | undefined,
): Promise<void> {
  let from: string;
  if (options.recent) {
    const days = parseInt(options.recent, 10);
    if (isNaN(days) || days <= 0) {
      console.error(error("--recent must be a positive integer"));
      process.exit(1);
    }
    const d = new Date();
    d.setDate(d.getDate() - days);
    from = d.toISOString().slice(0, 10);
  } else {
    from = options.from ?? "";
  }
  const to = options.to ?? new Date().toISOString().slice(0, 10);

  const spinner = createSpinner(`Downloading FR bulk XML from govinfo (${from} to ${to})`);
  spinner.start();

  try {
    const result = await downloadFrBulk({
      output: outputDir,
      from,
      to,
      concurrency,
      onProgress: (progress) => {
        const pct = progress.totalDays > 0 ? Math.round((progress.downloaded / progress.totalDays) * 100) : 0;
        spinner.text = `Downloading FR bulk XML (${formatNumber(progress.downloaded + progress.skipped)}/${formatNumber(progress.totalDays)}) ${pct}% ${progress.currentDate}`;
      },
    });

    const elapsed = performance.now() - startTime;
    spinner.succeed(`Downloaded ${formatNumber(result.filesDownloaded)} daily FR issues from govinfo`);

    console.log();
    const rows: [string, string][] = [
      ["Source", "govinfo (bulk daily XML)"],
      ["Date range", `${result.dateRange.from} → ${result.dateRange.to}`],
      ["Daily issues", formatNumber(result.filesDownloaded)],
      ["Total size", formatBytes(result.totalBytes)],
      ["Skipped (no issue)", formatNumber(result.skipped)],
      ["Duration", formatDuration(elapsed)],
    ];
    if (result.failed > 0) {
      rows.push(["Failed", formatNumber(result.failed)]);
    }
    rows.push(["Output", relative(process.cwd(), outputDir)]);

    console.log(summaryBlock({ title: "Download Complete", rows }));
  } catch (err) {
    spinner.fail("Download failed");
    console.error(error(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

// ── FR API date range download ──

async function downloadFrApi(
  options: DownloadFrOptions,
  outputDir: string,
  startTime: number,
  concurrency: number | undefined,
): Promise<void> {
  // Parse --types
  let types: FrDocumentType[] | undefined;
  if (options.types) {
    types = [];
    for (const raw of options.types.split(",")) {
      const normalized = raw.trim().toLowerCase();
      const mapped = VALID_TYPES.get(normalized);
      if (!mapped) {
        console.error(
          error(`Invalid document type "${raw.trim()}". Valid types: ${[...VALID_TYPES.keys()].join(", ")}`),
        );
        process.exit(1);
      }
      types.push(mapped);
    }
  }

  let from: string;
  if (options.recent) {
    const days = parseInt(options.recent, 10);
    if (isNaN(days) || days <= 0) {
      console.error(error("--recent must be a positive integer"));
      process.exit(1);
    }
    const d = new Date();
    d.setDate(d.getDate() - days);
    from = d.toISOString().slice(0, 10);
  } else {
    from = options.from ?? "";
  }

  const to = options.to ?? new Date().toISOString().slice(0, 10);
  let limit: number | undefined;
  if (options.limit) {
    limit = parseInt(options.limit, 10);
    if (isNaN(limit) || limit <= 0) {
      console.error(error("--limit must be a positive integer"));
      process.exit(1);
    }
  }

  const spinner = createSpinner(`Downloading Federal Register documents from ${from} to ${to}`);
  spinner.start();

  try {
    const result = await downloadFrDocuments({
      output: outputDir,
      from,
      to,
      types,
      limit,
      concurrency,
      onProgress: (progress) => {
        const pct =
          progress.totalDocuments > 0 ? Math.round((progress.documentsDownloaded / progress.totalDocuments) * 100) : 0;
        spinner.text = `Downloading FR documents (${formatNumber(progress.documentsDownloaded)}/${formatNumber(progress.totalDocuments)}) ${pct}% [${progress.currentChunk}] ${progress.currentDocument}`;
      },
    });

    const elapsed = performance.now() - startTime;
    spinner.succeed(`Downloaded ${formatNumber(result.documentsDownloaded)} Federal Register documents`);

    console.log();
    const rows: [string, string][] = [
      ["Source", "FederalRegister.gov API"],
      ["Date range", `${result.dateRange.from} → ${result.dateRange.to}`],
      ["Documents", formatNumber(result.documentsDownloaded)],
      ["Total size", formatBytes(result.totalBytes)],
      ["Duration", formatDuration(elapsed)],
    ];
    if (types) {
      rows.push(["Types", types.join(", ")]);
    }
    if (result.skipped > 0) {
      rows.push(["Skipped (no XML)", formatNumber(result.skipped)]);
    }
    if (result.failed.length > 0) {
      rows.push(["Failed", formatNumber(result.failed.length)]);
    }
    rows.push(["Output", relative(process.cwd(), outputDir)]);

    console.log(summaryBlock({ title: "Download Complete", rows }));

    if (result.failed.length > 0) {
      console.log();
      console.log(error(`${result.failed.length} document(s) failed to download:`));
      for (const f of result.failed.slice(0, 10)) {
        console.error(`  ${f.documentNumber}: ${f.error}`);
      }
      if (result.failed.length > 10) {
        console.error(`  ... and ${result.failed.length - 10} more`);
      }
    }
  } catch (err) {
    spinner.fail("Download failed");
    console.error(error(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
