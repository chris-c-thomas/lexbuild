/**
 * `law2md convert` command — converts USC XML files to Markdown.
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { convertTitle } from "@law2md/usc";
import {
  createSpinner,
  summaryBlock,
  formatDuration,
  formatBytes,
  formatNumber,
  success,
  error,
} from "../ui.js";

/** Parsed options from the convert command */
interface ConvertCommandOptions {
  output: string;
  granularity: "section" | "chapter";
  linkStyle: "relative" | "canonical" | "plaintext";
  includeSourceCredits: boolean;
  includeNotes: boolean;
  includeEditorialNotes: boolean;
  includeStatutoryNotes: boolean;
  includeAmendments: boolean;
  dryRun: boolean;
  verbose: boolean;
}

export const convertCommand = new Command("convert")
  .description("Convert USC XML file(s) to Markdown")
  .argument("<input>", "Path to a USC XML file")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option(
    "-g, --granularity <level>",
    'Output granularity: "section" (one file per section) or "chapter" (sections inline)',
    "section",
  )
  .option(
    "--link-style <style>",
    'Cross-reference link style: "relative", "canonical", or "plaintext"',
    "plaintext",
  )
  .option("--include-source-credits", "Include source credit annotations", true)
  .option("--no-include-source-credits", "Exclude source credit annotations")
  .option("--include-notes", "Include all notes (default)", true)
  .option("--no-include-notes", "Exclude all notes")
  .option("--include-editorial-notes", "Include editorial notes only", false)
  .option("--include-statutory-notes", "Include statutory notes only", false)
  .option("--include-amendments", "Include amendment history notes only", false)
  .option("--dry-run", "Parse and report structure without writing files", false)
  .option("-v, --verbose", "Enable verbose logging", false)
  .action(async (input: string, options: ConvertCommandOptions) => {
    const inputPath = resolve(input);

    if (!existsSync(inputPath)) {
      console.error(error(`Input file not found: ${inputPath}`));
      process.exit(1);
    }

    const outputPath = resolve(options.output);

    // If any specific include flag is set, disable includeNotes (switch to selective)
    const hasSelectiveFlags =
      options.includeEditorialNotes || options.includeStatutoryNotes || options.includeAmendments;
    const includeNotes = hasSelectiveFlags ? false : options.includeNotes;

    const dryRunLabel = options.dryRun ? " [dry-run]" : "";
    const spinner = createSpinner(`Converting${dryRunLabel}...`);
    spinner.start();

    const startTime = performance.now();

    try {
      const result = await convertTitle({
        input: inputPath,
        output: outputPath,
        granularity: options.granularity,
        linkStyle: options.linkStyle,
        includeSourceCredits: options.includeSourceCredits,
        includeNotes,
        includeEditorialNotes: options.includeEditorialNotes,
        includeStatutoryNotes: options.includeStatutoryNotes,
        includeAmendments: options.includeAmendments,
        dryRun: options.dryRun,
      });

      const elapsed = performance.now() - startTime;

      spinner.stop();

      // Build stats rows
      const rows: Array<[string, string]> = [
        ["Sections", formatNumber(result.sectionsWritten)],
        ["Chapters", formatNumber(result.chapterCount)],
        ["Est. Tokens", formatNumber(result.totalTokenEstimate)],
      ];

      if (!result.dryRun) {
        rows.push(["Files Written", formatNumber(result.files.length)]);
      }

      rows.push(
        ["Peak Memory", formatBytes(result.peakMemoryBytes)],
        ["Duration", formatDuration(elapsed)],
      );

      const titleLabel = result.dryRun
        ? `law2md — Title ${result.titleNumber}: ${result.titleName} [dry-run]`
        : `law2md — Title ${result.titleNumber}: ${result.titleName}`;

      const outputRelative = relative(process.cwd(), outputPath) || outputPath;

      const output = summaryBlock({
        title: titleLabel,
        rows: [...rows, ["Output", outputRelative]],
        footer: result.dryRun
          ? success("Dry run complete")
          : success("Conversion complete"),
      });
      process.stdout.write(output);

      // Verbose: list all files written
      if (options.verbose && !result.dryRun && result.files.length > 0) {
        console.log("  Files written:");
        for (const file of result.files) {
          console.log(`    ${relative(process.cwd(), file) || file}`);
        }
        console.log("");
      }
    } catch (err) {
      spinner.fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
