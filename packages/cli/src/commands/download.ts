/**
 * `law2md download` command — downloads USC XML from OLRC.
 */

import { Command } from "commander";
import { resolve } from "node:path";
import { downloadTitles, CURRENT_RELEASE_POINT } from "@law2md/usc";

/** Parsed options from the download command */
interface DownloadCommandOptions {
  output: string;
  title?: string | undefined;
  all: boolean;
  releasePoint: string;
}

export const downloadCommand = new Command("download")
  .description("Download U.S. Code XML from OLRC")
  .option("-o, --output <dir>", "Download directory", "./xml")
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
      console.error("Error: specify --title <n> for a single title or --all for all titles");
      process.exit(1);
    }

    // Parse title numbers
    let titles: number[] | undefined;
    if (options.title) {
      const num = parseInt(options.title, 10);
      if (isNaN(num) || num < 1 || num > 54) {
        console.error(`Error: invalid title number "${options.title}" (must be 1-54)`);
        process.exit(1);
      }
      titles = [num];
    }

    const outputDir = resolve(options.output);
    const titleCount = titles ? titles.length : 54;

    console.log(`Downloading ${titleCount === 1 ? `Title ${titles?.[0]}` : `all ${titleCount} titles`}`);
    console.log(`Release point: ${options.releasePoint}`);
    console.log(`Output: ${outputDir}`);
    console.log("");

    const startTime = performance.now();

    try {
      const result = await downloadTitles({
        outputDir,
        titles,
        releasePoint: options.releasePoint,
      });

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

      // Report results
      for (const file of result.files) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(1);
        console.log(`  Title ${file.titleNumber}: ${sizeMB} MB → ${file.filePath}`);
      }

      if (result.errors.length > 0) {
        console.log("");
        for (const err of result.errors) {
          console.error(`  Error (Title ${err.titleNumber}): ${err.message}`);
        }
      }

      console.log("");
      console.log(
        `Downloaded ${result.files.length} title(s) in ${elapsed}s` +
          (result.errors.length > 0 ? ` (${result.errors.length} failed)` : ""),
      );
    } catch (err) {
      console.error("Download failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });
