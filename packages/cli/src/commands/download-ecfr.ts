/**
 * `lexbuild download-ecfr` command — downloads eCFR XML from govinfo.
 */

import { Command } from "commander";
import { relative, resolve } from "node:path";
import { downloadEcfrTitles } from "@lexbuild/ecfr";
import {
  createSpinner,
  summaryBlock,
  dataTable,
  formatDuration,
  formatBytes,
  success,
  error,
} from "../ui.js";
import { parseTitles } from "../parse-titles.js";

/** Parsed options from the download-ecfr command */
interface DownloadEcfrOptions {
  output: string;
  titles?: string | undefined;
  all: boolean;
}

export const downloadEcfrCommand = new Command("download-ecfr")
  .description("Download eCFR XML from govinfo bulk data repository")
  .option("-o, --output <dir>", "Download directory", "./downloads/ecfr/xml")
  .option("--titles <spec>", "Title(s) to download: 1, 1-5, or 1-5,8,17")
  .option("--all", "Download all 50 eCFR titles", false)
  .addHelpText(
    "after",
    `
Examples:
  $ lexbuild download-ecfr --all                  Download all 50 titles
  $ lexbuild download-ecfr --titles 1             Download Title 1 only
  $ lexbuild download-ecfr --titles 1-5,17        Download specific titles
  $ lexbuild download-ecfr --all -o ./my-xml      Custom output directory

Source: https://www.govinfo.gov/bulkdata/ECFR`,
  )
  .action(async (options: DownloadEcfrOptions) => {
    if (!options.titles && !options.all) {
      console.error(error("Specify --titles <spec> or --all (e.g. --titles 1-5,17)"));
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
    const label =
      titleCount === 1
        ? `Downloading eCFR Title ${titles?.[0]}`
        : `Downloading ${titleCount} eCFR titles`;

    const spinner = createSpinner(`${label}...`);
    spinner.start();

    const startTime = performance.now();

    try {
      const result = await downloadEcfrTitles({
        output: outputDir,
        titles,
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

      const titleWord = result.titlesDownloaded === 1 ? "title" : "titles";
      const summary = `Downloaded ${result.titlesDownloaded} ${titleWord} (${formatBytes(result.totalBytes)}) in ${formatDuration(elapsed)}`;
      console.log(`  ${success(summary)}`);
      console.log("");
    } catch (err) {
      spinner.fail(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
