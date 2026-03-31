/**
 * `lexbuild convert-fr` command — converts Federal Register XML files to Markdown.
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { convertFrDocuments } from "@lexbuild/fr";
import type { FrDocumentType } from "@lexbuild/fr";
import {
  createSpinner,
  summaryBlock,
  formatDuration,
  formatNumber,
  error,
} from "../ui.js";

/** Valid document type values for --types flag */
const VALID_TYPES = new Map<string, FrDocumentType>([
  ["rule", "RULE"],
  ["proposed_rule", "PRORULE"],
  ["notice", "NOTICE"],
  ["presidential_document", "PRESDOCU"],
]);

/** Parsed options from the convert-fr command */
interface ConvertFrCommandOptions {
  output: string;
  inputDir: string;
  all: boolean;
  from?: string | undefined;
  to?: string | undefined;
  types?: string | undefined;
  linkStyle: "relative" | "canonical" | "plaintext";
  dryRun: boolean;
  verbose: boolean;
}

export const convertFrCommand = new Command("convert-fr")
  .description("Convert Federal Register XML to Markdown")
  .argument("[input]", "Path to single FR XML file (optional)")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("-i, --input-dir <dir>", "Directory containing downloaded FR files", "./downloads/fr")
  .option("--all", "Convert all downloaded documents in input directory", false)
  .option("--from <YYYY-MM-DD>", "Filter: start date")
  .option("--to <YYYY-MM-DD>", "Filter: end date")
  .option("--types <types>", "Filter: document types (rule, proposed_rule, notice, presidential_document)")
  .option("--link-style <style>", "Link style: relative, canonical, plaintext", "plaintext")
  .option("--dry-run", "Parse only, don't write files", false)
  .option("-v, --verbose", "Print detailed file output", false)
  .addHelpText(
    "after",
    `
Examples:
  $ lexbuild convert-fr --all                               Convert all downloaded FR documents
  $ lexbuild convert-fr --from 2026-01-01 --to 2026-03-31   Convert by date range
  $ lexbuild convert-fr --all --types rule                   Convert only rules
  $ lexbuild convert-fr ./downloads/fr/2026/03/2026-06029.xml   Convert single document
  $ lexbuild convert-fr --all --dry-run                      Preview without writing files`,
  )
  .action(async (inputArg: string | undefined, options: ConvertFrCommandOptions) => {
    // Validate: need [input], --all, or --from
    if (!inputArg && !options.all && !options.from) {
      console.error(
        error(
          "Specify a path to an XML file, --all, or --from <date>\n" +
            "Examples: convert-fr --all, convert-fr --from 2026-01-01",
        ),
      );
      process.exit(1);
    }

    // Parse --types
    let types: FrDocumentType[] | undefined;
    if (options.types) {
      types = [];
      for (const raw of options.types.split(",")) {
        const normalized = raw.trim().toLowerCase();
        const mapped = VALID_TYPES.get(normalized);
        if (!mapped) {
          console.error(
            error(
              `Invalid document type "${raw.trim()}". Valid types: ${[...VALID_TYPES.keys()].join(", ")}`,
            ),
          );
          process.exit(1);
        }
        types.push(mapped);
      }
    }

    // Determine input path
    let inputPath: string;
    if (inputArg) {
      inputPath = resolve(inputArg);
      if (!existsSync(inputPath)) {
        console.error(error(`File not found: ${inputArg}`));
        process.exit(1);
      }
    } else {
      inputPath = resolve(options.inputDir);
      if (!existsSync(inputPath)) {
        console.error(error(`Input directory not found: ${options.inputDir}`));
        process.exit(1);
      }
    }

    const outputPath = resolve(options.output);
    const startTime = performance.now();

    const spinner = createSpinner(
      options.dryRun
        ? "Analyzing Federal Register documents (dry run)"
        : "Converting Federal Register documents",
    );

    try {
      const result = await convertFrDocuments({
        input: inputPath,
        output: outputPath,
        linkStyle: options.linkStyle,
        dryRun: options.dryRun,
        from: options.from,
        to: options.to,
        types,
      });

      const elapsed = performance.now() - startTime;

      if (options.dryRun) {
        spinner.succeed(
          `Dry run: ${formatNumber(result.documentsConverted)} documents would be converted`,
        );
      } else {
        spinner.succeed(
          `Converted ${formatNumber(result.documentsConverted)} Federal Register documents`,
        );
      }

      console.log();

      const rows: [string, string][] = [
        ["Documents", formatNumber(result.documentsConverted)],
      ];

      if (!options.dryRun) {
        rows.push(["Est. tokens", formatNumber(result.totalTokenEstimate)]);
      }

      rows.push(["Duration", formatDuration(elapsed)]);

      if (!options.dryRun) {
        rows.push(["Output", relative(process.cwd(), outputPath) + "/fr/"]);
      }

      const footer = options.dryRun
        ? undefined
        : `Converted ${formatNumber(result.documentsConverted)} documents in ${formatDuration(elapsed)}`;

      console.log(summaryBlock({ title: "Conversion Complete", rows, footer }));

      if (options.verbose && !options.dryRun) {
        console.log();
        for (const file of result.files.slice(0, 20)) {
          console.log(`  ${relative(process.cwd(), file)}`);
        }
        if (result.files.length > 20) {
          console.log(`  ... and ${result.files.length - 20} more`);
        }
      }
    } catch (err) {
      spinner.fail("Conversion failed");
      console.error(error(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });
