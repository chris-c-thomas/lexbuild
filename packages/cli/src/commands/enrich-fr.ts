/**
 * `lexbuild enrich-fr` command — enriches FR Markdown frontmatter with API metadata.
 *
 * Fetches rich metadata from the FederalRegister.gov API listing endpoint and
 * patches existing .md files that were converted from govinfo bulk XML. Does not
 * re-parse XML or re-render Markdown — only updates YAML frontmatter.
 */

import { Command } from "commander";
import { resolve } from "node:path";
import { enrichFrDocuments } from "@lexbuild/fr";
import { createSpinner, summaryBlock, formatDuration, formatNumber, error } from "../ui.js";

/** Parsed options from the enrich-fr command */
interface EnrichFrCliOptions {
  output: string;
  from?: string | undefined;
  to?: string | undefined;
  recent?: string | undefined;
  force?: boolean | undefined;
}

export const enrichFrCommand = new Command("enrich-fr")
  .description("Enrich FR Markdown frontmatter with FederalRegister.gov API metadata")
  .option("-o, --output <dir>", "Output directory containing FR .md files", "./output")
  .option("--from <YYYY-MM-DD>", "Start date (inclusive)")
  .option("--to <YYYY-MM-DD>", "End date (inclusive, defaults to today)")
  .option("--recent <days>", "Enrich last N days")
  .option("--force", "Overwrite already-enriched files (have fr_citation)")
  .addHelpText(
    "after",
    `
Examples:
  $ lexbuild enrich-fr --from 2000-01-01 --to 2026-03-25
  $ lexbuild enrich-fr --recent 30
  $ lexbuild enrich-fr --from 2020-01-01 --force

This command fetches metadata from the FederalRegister.gov API listing endpoint
and patches YAML frontmatter in existing .md files. Use it to backfill rich
metadata (agencies, CFR references, docket IDs, citations, etc.) into files
that were originally converted from govinfo bulk XML.

Files that already have fr_citation are skipped unless --force is used.`,
  )
  .action(async (options: EnrichFrCliOptions) => {
    // Validate: need --from or --recent
    if (!options.from && !options.recent) {
      console.error(error("Specify --from <date> or --recent <days>\n" + "Examples: --from 2000-01-01, --recent 30"));
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
    const outputDir = resolve(options.output);
    const startTime = performance.now();

    const spinner = createSpinner(`Enriching FR frontmatter (${from} to ${to})`);
    spinner.start();

    try {
      const result = await enrichFrDocuments({
        output: outputDir,
        from,
        to,
        force: options.force,
        onProgress: (progress) => {
          const processed = progress.enriched + progress.skipped + progress.notFound;
          const pct = progress.total > 0 ? Math.round((processed / progress.total) * 100) : 0;
          spinner.text = `Enriching FR frontmatter (${formatNumber(progress.enriched)} enriched, ${formatNumber(progress.skipped)} skipped) ${pct}% [${progress.currentChunk}] ${progress.currentDocument}`;
        },
      });

      const elapsed = performance.now() - startTime;
      spinner.succeed(`Enriched ${formatNumber(result.enriched)} FR documents`);

      console.log();
      const rows: [string, string][] = [
        ["Date range", `${result.dateRange.from} → ${result.dateRange.to}`],
        ["API documents", formatNumber(result.total)],
        ["Enriched", formatNumber(result.enriched)],
        ["Skipped", formatNumber(result.skipped)],
        ["Not found", formatNumber(result.notFound)],
        ["Duration", formatDuration(elapsed)],
      ];

      console.log(summaryBlock({ title: "Enrichment Complete", rows }));
    } catch (err) {
      spinner.fail("Enrichment failed");
      console.error(error(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });
