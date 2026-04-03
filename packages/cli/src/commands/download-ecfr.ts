/**
 * `lexbuild download-ecfr` command — downloads eCFR XML from govinfo or eCFR API.
 */

import { Command } from "commander";
import { relative, resolve } from "node:path";
import { downloadEcfrTitles, downloadEcfrTitlesFromApi, fetchEcfrTitlesMeta } from "@lexbuild/ecfr";
import type { EcfrTitlesResponse } from "@lexbuild/ecfr";
import { createSpinner, summaryBlock, dataTable, formatDuration, formatBytes, success, error } from "../ui.js";
import { parseTitles } from "../parse-titles.js";

/** Valid download source values */
type EcfrSource = "govinfo" | "ecfr-api";

/** Parsed options from the download-ecfr command */
interface DownloadEcfrOptions {
  output: string;
  titles?: string | undefined;
  all: boolean;
  source: EcfrSource;
  date?: string | undefined;
}

export const downloadEcfrCommand = new Command("download-ecfr")
  .description("Download eCFR XML from govinfo or eCFR API")
  .option("-o, --output <dir>", "Download directory", "./downloads/ecfr/xml")
  .option("--titles <spec>", "Title(s) to download: 1, 1-5, or 1-5,8,17")
  .option("--all", "Download all 50 eCFR titles", false)
  .option("--source <source>", "Download source: ecfr-api (daily-updated) or govinfo (bulk data)", "ecfr-api")
  .option("--date <YYYY-MM-DD>", "Point-in-time date (ecfr-api source only)")
  .addHelpText(
    "after",
    `
Examples:
  $ lexbuild download-ecfr --all                          Download all titles from eCFR API
  $ lexbuild download-ecfr --titles 1                     Download Title 1 only
  $ lexbuild download-ecfr --titles 1-5,17                Download specific titles
  $ lexbuild download-ecfr --all --date 2026-01-01        Point-in-time download
  $ lexbuild download-ecfr --all --source govinfo         Download from govinfo bulk data

Sources:
  ecfr-api  — eCFR API from ecfr.gov (default, daily-updated, point-in-time support)
  govinfo   — Bulk XML from govinfo.gov (updates irregularly)`,
  )
  .action(async (options: DownloadEcfrOptions) => {
    if (!options.titles && !options.all) {
      console.error(error("Specify --titles <spec> or --all (e.g. --titles 1-5,17)"));
      process.exit(1);
    }

    // Validate source
    const validSources: EcfrSource[] = ["govinfo", "ecfr-api"];
    if (!validSources.includes(options.source)) {
      console.error(error(`Invalid source "${options.source}". Valid sources: ${validSources.join(", ")}`));
      process.exit(1);
    }

    // --date is only valid with ecfr-api source
    if (options.date && options.source !== "ecfr-api") {
      console.error(error("--date is only supported with --source ecfr-api"));
      process.exit(1);
    }

    // Validate date format if provided
    if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      console.error(error("--date must be in YYYY-MM-DD format"));
      process.exit(1);
    }

    let titles: number[] | undefined;
    if (options.titles) {
      try {
        titles = parseTitles(options.titles, 50);
      } catch (err) {
        console.error(error(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    }

    const outputDir = resolve(options.output);
    const titleCount = titles ? titles.length : 50;
    const sourceLabel = options.source === "ecfr-api" ? "eCFR API" : "govinfo";

    // For ecfr-api, fetch metadata upfront to resolve dates and display status
    let meta: EcfrTitlesResponse | undefined;
    if (options.source === "ecfr-api" && !options.date) {
      const metaSpinner = createSpinner("Fetching eCFR title metadata...");
      metaSpinner.start();
      try {
        meta = await fetchEcfrTitlesMeta();
        metaSpinner.succeed("eCFR title metadata loaded");
      } catch (err) {
        metaSpinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }

    // Build spinner label with date info
    let dateLabel = "";
    let statusNote = "";
    if (options.date) {
      dateLabel = ` as of ${options.date}`;
    } else if (meta) {
      const primaryDate = meta.importInProgress
        ? (() => {
            const prev = new Date(meta.date);
            prev.setDate(prev.getDate() - 1);
            return prev.toISOString().slice(0, 10);
          })()
        : meta.date;
      dateLabel = ` as of ${primaryDate}`;

      // Check for titles with individual processing
      const processingTitles = meta.titles.filter((t) => t.processingInProgress && !t.reserved);
      if (meta.importInProgress && processingTitles.length > 0) {
        const titleWord = processingTitles.length === 1 ? "title uses" : "titles use";
        statusNote = ` (import in progress, ${processingTitles.length} ${titleWord} earlier dates)`;
      } else if (meta.importInProgress) {
        statusNote = " (import in progress, using previous day)";
      } else if (processingTitles.length > 0) {
        const nums = processingTitles.map((t) => t.number).join(", ");
        statusNote = ` (Title ${nums} processing, using earlier date)`;
      }
    }

    const label =
      titleCount === 1
        ? `Downloading eCFR Title ${titles?.[0]} from ${sourceLabel}${dateLabel}${statusNote}`
        : `Downloading ${titleCount} eCFR titles from ${sourceLabel}${dateLabel}${statusNote}`;

    const spinner = createSpinner(`${label}...`);
    spinner.start();

    const startTime = performance.now();

    try {
      if (options.source === "ecfr-api") {
        await downloadFromApi(options, titles, outputDir, spinner, startTime, meta);
      } else {
        await downloadFromGovinfo(titles, outputDir, spinner, startTime);
      }
    } catch (err) {
      spinner.fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/** Download from govinfo bulk data (existing behavior) */
async function downloadFromGovinfo(
  titles: number[] | undefined,
  outputDir: string,
  spinner: ReturnType<typeof createSpinner>,
  startTime: number,
): Promise<void> {
  const result = await downloadEcfrTitles({
    output: outputDir,
    titles,
    onProgress: ({ current, total, titleNumber }) => {
      if (total === 1) {
        spinner.text = `Downloading eCFR Title ${titleNumber} from govinfo`;
      } else {
        spinner.text = `Downloading eCFR titles from govinfo (${current}/${total}) — Title ${titleNumber}`;
      }
    },
  });

  const elapsed = performance.now() - startTime;
  spinner.stop();

  const fileRows = result.files.map((file) => [
    String(file.titleNumber),
    formatBytes(file.size),
    relative(outputDir, file.path) || file.path,
  ]);

  const output = summaryBlock({
    title: "lexbuild — eCFR Download Summary",
    rows: [
      ["Source", "govinfo.gov/bulkdata/ECFR"],
      ["Directory", relative(process.cwd(), outputDir) || outputDir],
    ],
  });
  process.stdout.write(output);

  if (fileRows.length > 0) {
    console.log(dataTable(["Title", "Size", "File"], fileRows));
  }

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.log(`  ${error(`Title ${err.titleNumber}: ${err.error}`)}`);
    }
  }

  const titleWord = result.titlesDownloaded === 1 ? "title" : "titles";
  const failSuffix = result.errors.length > 0 ? ` (${result.errors.length} failed)` : "";
  const summary = `Downloaded ${result.titlesDownloaded} ${titleWord} (${formatBytes(result.totalBytes)}) in ${formatDuration(elapsed)}`;
  console.log(`  ${success(summary + failSuffix)}`);
  console.log("");
}

/** Download from eCFR API (daily-updated, point-in-time) */
async function downloadFromApi(
  options: DownloadEcfrOptions,
  titles: number[] | undefined,
  outputDir: string,
  spinner: ReturnType<typeof createSpinner>,
  startTime: number,
  meta?: EcfrTitlesResponse,
): Promise<void> {
  const result = await downloadEcfrTitlesFromApi({
    output: outputDir,
    titles,
    date: options.date,
    titlesMeta: meta,
    onProgress: ({ current, total, titleNumber }) => {
      if (total === 1) {
        spinner.text = `Downloading eCFR Title ${titleNumber} from eCFR API`;
      } else {
        spinner.text = `Downloading eCFR titles from eCFR API (${current}/${total}) — Title ${titleNumber}`;
      }
    },
  });

  const elapsed = performance.now() - startTime;
  spinner.stop();

  // Check if any titles used different dates
  const uniqueDates = new Set(result.files.map((f) => f.asOfDate));
  const dateDisplay =
    uniqueDates.size <= 1 ? result.asOfDate : `${result.asOfDate} (${uniqueDates.size - 1} titles at earlier dates)`;

  const fileRows = result.files.map((file) => {
    const row = [String(file.titleNumber), formatBytes(file.size), relative(outputDir, file.path) || file.path];
    // Show the date if it differs from the primary
    if (file.asOfDate !== result.asOfDate) {
      row.push(file.asOfDate);
    }
    return row;
  });

  const summaryRows: [string, string][] = [
    ["Source", "ecfr.gov/api/versioner/v1"],
    ["As of date", dateDisplay],
    ["Directory", relative(process.cwd(), outputDir) || outputDir],
  ];

  const output = summaryBlock({
    title: "lexbuild — eCFR Download Summary",
    rows: summaryRows,
  });
  process.stdout.write(output);

  // Include date column only if some titles used different dates
  const hasMultipleDates = uniqueDates.size > 1;
  const headings = hasMultipleDates ? ["Title", "Size", "File", "Date"] : ["Title", "Size", "File"];

  if (fileRows.length > 0) {
    console.log(dataTable(headings, fileRows));
  }

  // Report failures with context
  if (result.failed.length > 0) {
    const processing = result.failed.filter((f) => f.status === 503);
    const other = result.failed.filter((f) => f.status !== 503);

    if (processing.length > 0) {
      const nums = processing.map((f) => `Title ${f.titleNumber}`).join(", ");
      console.log(`  ${error(`Unavailable (processing on server): ${nums}`)}`);
      console.log(`    The eCFR API cannot serve these titles while an import is in progress.`);
      console.log(`    Re-run this command later to download them. Existing local files (if any) are preserved.`);
    }
    if (other.length > 0) {
      const nums = other.map((f) => `Title ${f.titleNumber} (${f.status})`).join(", ");
      console.log(`  ${error(`Failed: ${nums}`)}`);
    }
  }

  const titleWord = result.titlesDownloaded === 1 ? "title" : "titles";
  const failSuffix = result.failed.length > 0 ? ` (${result.failed.length} failed)` : "";
  const summary = `Downloaded ${result.titlesDownloaded} ${titleWord} (${formatBytes(result.totalBytes)}) in ${formatDuration(elapsed)}`;
  console.log(`  ${success(summary + failSuffix)}`);
  console.log("");
}
