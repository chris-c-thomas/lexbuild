/**
 * `law2md convert` command — converts USC XML files to Markdown.
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { convertTitle } from "@law2md/usc";

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
      console.error(`Error: Input file not found: ${inputPath}`);
      process.exit(1);
    }

    const outputPath = resolve(options.output);

    // If any specific include flag is set, disable includeNotes (switch to selective)
    const hasSelectiveFlags =
      options.includeEditorialNotes || options.includeStatutoryNotes || options.includeAmendments;
    const includeNotes = hasSelectiveFlags ? false : options.includeNotes;

    if (options.verbose) {
      console.log(`Input:  ${inputPath}`);
      console.log(`Output: ${outputPath}`);
      console.log(`Link style: ${options.linkStyle}`);
      console.log(`Source credits: ${options.includeSourceCredits}`);
      if (!includeNotes && !hasSelectiveFlags) {
        console.log(`Notes: excluded`);
      } else if (hasSelectiveFlags) {
        const flags: string[] = [];
        if (options.includeEditorialNotes) flags.push("editorial");
        if (options.includeStatutoryNotes) flags.push("statutory");
        if (options.includeAmendments) flags.push("amendments");
        console.log(`Notes: ${flags.join(", ")}`);
      } else {
        console.log(`Notes: all`);
      }
      console.log("");
    }

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

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const memMB = (result.peakMemoryBytes / 1024 / 1024).toFixed(1);

      if (result.dryRun) {
        console.log(`[dry-run] ${result.titleName} (Title ${result.titleNumber})`);
        console.log(`  Chapters:         ${result.chapterCount}`);
        console.log(`  Sections:         ${result.sectionsWritten}`);
        console.log(`  Estimated tokens: ${result.totalTokenEstimate.toLocaleString()}`);
        console.log(`  Parse time:       ${elapsed}s`);
        console.log(`  Peak memory:      ${memMB} MB`);
      } else {
        console.log(
          `Converted ${result.titleName} (Title ${result.titleNumber}): ` +
            `${result.sectionsWritten} sections, ${result.chapterCount} chapters in ${elapsed}s`,
        );

        if (options.verbose) {
          console.log(`  Estimated tokens: ${result.totalTokenEstimate.toLocaleString()}`);
          console.log(`  Peak memory:      ${memMB} MB`);
          if (result.files.length > 0) {
            console.log(`\nFiles written:`);
            for (const file of result.files) {
              console.log(`  ${file}`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error converting ${inputPath}:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });
