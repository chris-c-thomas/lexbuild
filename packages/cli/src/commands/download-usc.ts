/**
 * `lexbuild download-usc` command — downloads USC XML from OLRC.
 *
 * Auto-detects the latest OLRC release point unless overridden with --release-point.
 */

import { Command } from "commander";
import { relative, resolve } from "node:path";
import { downloadTitles, detectLatestReleasePoint, FALLBACK_RELEASE_POINT } from "@lexbuild/usc";
import { createSpinner, summaryBlock, dataTable, formatDuration, formatBytes, success, error } from "../ui.js";
import { parseTitles } from "../parse-titles.js";

/** Parsed options from the download command */
interface DownloadCommandOptions {
  output: string;
  titles?: string | undefined;
  all: boolean;
  releasePoint?: string | undefined;
}

export const downloadUscCommand = new Command("download-usc")
  .description("Download U.S. Code XML from OLRC")
  .option("-o, --output <dir>", "Download directory", "./downloads/usc/xml")
  .option("--titles <spec>", "Title(s) to download: 1, 1-5, or 1-5,8,11")
  .option("--all", "Download all 54 titles (single bulk zip)", false)
  .option("--release-point <id>", "OLRC release point (auto-detected if omitted)")
  .addHelpText(
    "after",
    `
Examples:
  $ lexbuild download-usc --all                      Download all 54 titles (latest release)
  $ lexbuild download-usc --titles 1                 Download Title 1 only
  $ lexbuild download-usc --titles 1-5,8,11          Download specific titles
  $ lexbuild download-usc --all -o ./my-xml          Custom output directory
  $ lexbuild download-usc --all --release-point 119-73not60  Pin a specific release

The latest release point is auto-detected from the OLRC download page.
Source: https://uscode.house.gov/download/download.shtml`,
  )
  .action(async (options: DownloadCommandOptions) => {
    // Validate: must specify --titles or --all
    if (!options.titles && !options.all) {
      console.error(error("Specify --titles <spec> or --all (e.g. --titles 1-5,8,11)"));
      process.exit(1);
    }

    // Parse title numbers
    let titles: number[] | undefined;
    if (options.titles) {
      try {
        titles = parseTitles(options.titles);
      } catch (err) {
        console.error(error(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    }

    const outputDir = resolve(options.output);
    const titleCount = titles ? titles.length : 54;

    // Resolve release point: use explicit flag, auto-detect, or fall back
    let releasePoint = options.releasePoint;
    if (!releasePoint) {
      const detectSpinner = createSpinner("Detecting latest OLRC release point...");
      detectSpinner.start();
      const detected = await detectLatestReleasePoint();
      if (detected) {
        releasePoint = detected.releasePoint;
        detectSpinner.succeed(`Release point: ${detected.releasePoint}`);
      } else {
        releasePoint = FALLBACK_RELEASE_POINT;
        detectSpinner.warn(`Could not detect release point, using fallback: ${releasePoint}`);
      }
    }

    const label = titleCount === 1 ? `Downloading Title ${titles?.[0]}` : `Downloading ${titleCount} USC titles`;

    const spinner = createSpinner(`${label}...`);
    spinner.start();

    const startTime = performance.now();

    try {
      const result = await downloadTitles({
        outputDir,
        titles,
        releasePoint,
        onProgress: ({ current, total, titleNumber, phase }) => {
          if (phase === "extracting") {
            spinner.text = `Extracting USC titles (${current}/${total}) — Title ${titleNumber}`;
          } else if (total === 1) {
            spinner.text = `Downloading USC Title ${titleNumber}`;
          } else if (current === 0) {
            spinner.text = "Downloading USC bulk archive";
          } else {
            spinner.text = `Downloading USC titles (${current}/${total}) — Title ${titleNumber}`;
          }
        },
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

      // Summary header — show the actual release point used (may be auto-detected)
      const rpLabel = options.releasePoint ? result.releasePoint : `${result.releasePoint} (auto-detected)`;

      const output = summaryBlock({
        title: "lexbuild — Download Summary",
        rows: [
          ["Release Point", rpLabel],
          ["Directory", relative(process.cwd(), outputDir) || outputDir],
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
      const failSuffix = result.errors.length > 0 ? ` (${result.errors.length} failed)` : "";
      console.log(`  ${success(summary + failSuffix)}`);
      console.log("");
    } catch (err) {
      spinner.fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
