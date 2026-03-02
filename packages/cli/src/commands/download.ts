/**
 * `law2md download` command — downloads USC XML from OLRC.
 */

import { Command } from "commander";
import { relative, resolve } from "node:path";
import { downloadTitles, CURRENT_RELEASE_POINT } from "@law2md/usc";
import {
  createSpinner,
  summaryBlock,
  dataTable,
  formatDuration,
  formatBytes,
  success,
  error,
} from "../ui.js";

/** Parsed options from the download command */
interface DownloadCommandOptions {
  output: string;
  title?: string | undefined;
  all: boolean;
  releasePoint: string;
}

export const downloadCommand = new Command("download")
  .description("Download U.S. Code XML from OLRC")
  .option("-o, --output <dir>", "Download directory", "./downloads/usc/xml")
  .option("--title <n>", "Download a single title (1-54)")
  .option("--all", "Download all 54 titles", false)
  .option(
    "--release-point <id>",
    `Release point identifier (default: ${CURRENT_RELEASE_POINT})`,
    CURRENT_RELEASE_POINT,
  )
  .action(async (options: DownloadCommandOptions) => {
    // Validate: must specify --title or --all
    if (!options.title && !options.all) {
      console.error(error("Specify --title <n> for a single title or --all for all titles"));
      process.exit(1);
    }

    // Parse title numbers
    let titles: number[] | undefined;
    if (options.title) {
      const num = parseInt(options.title, 10);
      if (isNaN(num) || num < 1 || num > 54) {
        console.error(error(`Invalid title number "${options.title}" (must be 1-54)`));
        process.exit(1);
      }
      titles = [num];
    }

    const outputDir = resolve(options.output);
    const titleCount = titles ? titles.length : 54;
    const label =
      titleCount === 1 ? `Downloading Title ${titles?.[0]}` : `Downloading all ${titleCount} titles`;

    const spinner = createSpinner(`${label}...`);
    spinner.start();

    const startTime = performance.now();

    try {
      const result = await downloadTitles({
        outputDir,
        titles,
        releasePoint: options.releasePoint,
      });

      const elapsed = performance.now() - startTime;

      spinner.stop();

      // Build file table rows
      const fileRows = result.files.map((file) => [
        String(file.titleNumber),
        formatBytes(file.size),
        relative(outputDir, file.filePath) || file.filePath,
      ]);

      const totalBytes = result.files.reduce((sum, f) => sum + f.size, 0);

      // Summary header
      const output = summaryBlock({
        title: "law2md — Download Summary",
        rows: [
          ["Release Point", options.releasePoint],
          ["Output", relative(process.cwd(), outputDir) || outputDir],
        ],
      });
      process.stdout.write(output);

      // File table
      if (fileRows.length > 0) {
        console.log(dataTable(["Title", "Size", "File"], fileRows));
      }

      // Errors
      if (result.errors.length > 0) {
        console.log("");
        for (const err of result.errors) {
          console.log(`  ${error(`Title ${err.titleNumber}: ${err.message}`)}`);
        }
      }

      // Footer
      const titleWord = result.files.length === 1 ? "title" : "titles";
      const summary = `Downloaded ${result.files.length} ${titleWord} (${formatBytes(totalBytes)}) in ${formatDuration(elapsed)}`;
      const failSuffix =
        result.errors.length > 0 ? ` (${result.errors.length} failed)` : "";
      console.log(`  ${success(summary + failSuffix)}`);
      console.log("");
    } catch (err) {
      spinner.fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
