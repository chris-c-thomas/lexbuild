/**
 * `lexbuild convert-usc` command — converts USC XML files to Markdown.
 */

import chalk from "chalk";
import { Command, Option } from "commander";
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { convertTitle } from "@lexbuild/usc";
import {
  createSpinner,
  summaryBlock,
  dataTable,
  formatDuration,
  formatBytes,
  formatNumber,
  success,
  error,
} from "../ui.js";
import { parseTitles } from "../parse-titles.js";

/** Parsed options from the convert command */
interface ConvertCommandOptions {
  output: string;
  titles?: string | undefined;
  all: boolean;
  inputDir: string;
  granularity: "section" | "chapter" | "title";
  linkStyle: "relative" | "canonical" | "plaintext";
  includeSourceCredits: boolean;
  includeNotes: boolean;
  includeEditorialNotes: boolean;
  includeStatutoryNotes: boolean;
  includeAmendments: boolean;
  dryRun: boolean;
  verbose: boolean;
}

/** Build the shared convert options from CLI flags. */
function buildConvertOptions(inputPath: string, outputPath: string, options: ConvertCommandOptions) {
  const hasSelectiveFlags = options.includeEditorialNotes || options.includeStatutoryNotes || options.includeAmendments;
  const includeNotes = hasSelectiveFlags ? false : options.includeNotes;

  return {
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
  };
}

/** Resolve the XML file path for a given title number. */
function titleXmlPath(inputDir: string, titleNum: number): string {
  const padded = String(titleNum).padStart(2, "0");
  return join(inputDir, `usc${padded}.xml`);
}

/** Try to resolve a USC XML path, falling back to zero-padded filename. */
export function resolveUscXmlPath(inputPath: string): string | undefined {
  if (existsSync(inputPath)) return inputPath;

  // Check if filename matches usc{N}.xml pattern and try zero-padded
  const dir = dirname(inputPath);
  const base = basename(inputPath);
  const match = /^usc(\d+)\.xml$/.exec(base);
  if (match?.[1]) {
    const padded = match[1].padStart(2, "0");
    const paddedPath = join(dir, `usc${padded}.xml`);
    if (existsSync(paddedPath)) return paddedPath;
  }

  return undefined;
}

/** Regex matching USC XML filenames like usc01.xml, usc54.xml */
const USC_XML_RE = /^usc(\d{2})\.xml$/;

/**
 * Scan a directory for USC XML files and return their title numbers, sorted.
 */
export function discoverTitles(inputDir: string): number[] {
  if (!existsSync(inputDir)) return [];

  return readdirSync(inputDir)
    .map((name) => USC_XML_RE.exec(name))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => parseInt(m[1] ?? "0", 10))
    .sort((a, b) => a - b);
}

/** Result from runConversion including elapsed time. */
interface ConversionRun {
  result: Awaited<ReturnType<typeof convertTitle>>;
  elapsed: number;
}

/** Run a conversion without printing output. Returns the result and elapsed time. */
async function runConversion(
  inputPath: string,
  outputPath: string,
  options: ConvertCommandOptions,
): Promise<ConversionRun> {
  const startTime = performance.now();
  const result = await convertTitle(buildConvertOptions(inputPath, outputPath, options));
  const elapsed = performance.now() - startTime;
  return { result, elapsed };
}

/** Convert a single XML file and print its detailed summary. */
async function convertSingleFile(
  inputPath: string,
  outputPath: string,
  options: ConvertCommandOptions,
  spinnerLabel: string,
) {
  const spinner = createSpinner(spinnerLabel);
  spinner.start();

  try {
    const { result, elapsed } = await runConversion(inputPath, outputPath, options);

    spinner.stop();

    const rows: Array<[string, string]> = [];
    if (options.granularity === "section") {
      rows.push(["Sections", formatNumber(result.sectionsWritten)]);
      rows.push(["Chapters", formatNumber(result.chapterCount)]);
    } else if (options.granularity === "chapter") {
      rows.push(["Chapters", formatNumber(result.chapterCount)]);
    }
    rows.push(["Est. Tokens", formatNumber(result.totalTokenEstimate)]);

    if (!result.dryRun) {
      rows.push(["Files Written", formatNumber(result.files.length)]);
    }

    rows.push(["Peak Memory", formatBytes(result.peakMemoryBytes)], ["Duration", formatDuration(elapsed)]);

    const titleLabel = result.dryRun
      ? `lexbuild — Title ${result.titleNumber}: ${result.titleName} [dry-run]`
      : `lexbuild — Title ${result.titleNumber}: ${result.titleName}`;

    const outputRelative = relative(process.cwd(), outputPath) || outputPath;

    const output = summaryBlock({
      title: titleLabel,
      rows: [...rows, ["Output", outputRelative]],
      footer: result.dryRun ? success("Dry run complete") : success("Conversion complete"),
    });
    process.stdout.write(output);

    if (options.verbose && !result.dryRun && result.files.length > 0) {
      console.log("  Files written:");
      for (const file of result.files) {
        console.log(`    ${relative(process.cwd(), file) || file}`);
      }
      console.log("");
    }

    return result;
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

export const convertUscCommand = new Command("convert-usc")
  .description("Convert U.S. Code XML file(s) to Markdown")
  .argument("[input]", "Path to a USC XML file")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("--titles <spec>", "Title(s) to convert: 1, 1-5, or 1-5,8,11")
  .option("--all", "Convert all downloaded titles found in --input-dir", false)
  .option("-i, --input-dir <dir>", "Directory containing USC XML files", "./downloads/usc/xml")
  .addOption(
    new Option("-g, --granularity <level>", "Output granularity: section, chapter, or title")
      .choices(["section", "chapter", "title"])
      .default("section"),
  )
  .addOption(
    new Option("--link-style <style>", "Link style: relative, canonical, or plaintext")
      .choices(["relative", "canonical", "plaintext"])
      .default("plaintext"),
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
  .addHelpText(
    "after",
    `
Input modes (use exactly one):
  <input>       Convert a single XML file
  --titles      Convert specific titles by number
  --all         Convert all titles in --input-dir

Granularity:
  section       One .md file per section (default)
  chapter       One .md file per chapter, sections inlined
  title         One .md file per title, entire hierarchy inlined

Examples:
  $ lexbuild convert-usc --titles 1                   Convert Title 1
  $ lexbuild convert-usc --titles 1-5,8,11            Convert a mix of titles
  $ lexbuild convert-usc --all -g chapter             All titles, chapter-level
  $ lexbuild convert-usc --titles 26 -g title         Title 26 as a single file
  $ lexbuild convert-usc --all --dry-run              Preview stats only
  $ lexbuild convert-usc ./downloads/usc/xml/usc01.xml -o ./out`,
  )
  .action(async (input: string | undefined, options: ConvertCommandOptions) => {
    // Validate: must specify exactly one of <input>, --titles, or --all
    const modeCount = [input, options.titles, options.all].filter(Boolean).length;
    if (modeCount === 0) {
      console.error(error("Specify an input file, --titles <spec>, or --all (e.g. --titles 1-5,8,11)"));
      process.exit(1);
    }
    if (modeCount > 1) {
      console.error(error("Cannot combine <input>, --titles, and --all — use only one"));
      process.exit(1);
    }

    const outputPath = resolve(options.output);
    const dryRunLabel = options.dryRun ? " [dry-run]" : "";

    // Single-file mode
    if (input) {
      const rawPath = resolve(input);
      const inputPath = resolveUscXmlPath(rawPath);
      if (!inputPath) {
        console.error(error(`Input file not found: ${rawPath}`));
        process.exit(1);
      }
      await convertSingleFile(inputPath, outputPath, options, `Converting${dryRunLabel}...`);
      return;
    }

    // Multi-title mode
    let titles: number[];
    if (options.all) {
      const inputDir = resolve(options.inputDir);
      titles = discoverTitles(inputDir);
      if (titles.length === 0) {
        console.error(error(`No USC XML files found in ${inputDir}`));
        process.exit(1);
      }
    } else {
      const titlesSpec = options.titles as string;
      try {
        titles = parseTitles(titlesSpec);
      } catch (err) {
        console.error(error(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    }

    const inputDir = resolve(options.inputDir);
    const totalTitles = titles.length;
    const results: ConversionRun[] = [];

    const spinner = createSpinner(`Converting${dryRunLabel}...`);
    spinner.start();

    for (const [i, titleNum] of titles.entries()) {
      const xmlPath = titleXmlPath(inputDir, titleNum);

      if (!existsSync(xmlPath)) {
        spinner.stop();
        console.error(error(`XML file not found: ${xmlPath}`));
        process.exit(1);
      }

      spinner.text = `Converting Title ${titleNum}${dryRunLabel} (${i + 1}/${totalTitles})...`;

      try {
        const run = await runConversion(xmlPath, outputPath, options);
        results.push(run);
      } catch (err) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }

    spinner.stop();

    // Summary header
    const outputRelative = relative(process.cwd(), outputPath) || outputPath;
    const headerTitle = options.dryRun ? "lexbuild — Conversion Summary [dry-run]" : "lexbuild — Conversion Summary";
    const header = summaryBlock({
      title: headerTitle,
      rows: [["Directory", outputRelative]],
    });
    process.stdout.write(header);

    // Build data table rows — adapt columns to granularity
    const granularity = options.granularity;
    let totalSections = 0;
    let totalChapters = 0;
    let totalTokens = 0;
    let totalElapsed = 0;

    const tableRows = results.map(({ result, elapsed }) => {
      totalSections += result.sectionsWritten;
      totalChapters += result.chapterCount;
      totalTokens += result.totalTokenEstimate;
      totalElapsed += elapsed;

      if (granularity === "title") {
        return [result.titleNumber, result.titleName, formatNumber(result.totalTokenEstimate), formatDuration(elapsed)];
      } else if (granularity === "chapter") {
        return [
          result.titleNumber,
          result.titleName,
          formatNumber(result.chapterCount),
          formatNumber(result.totalTokenEstimate),
          formatDuration(elapsed),
        ];
      } else {
        return [
          result.titleNumber,
          result.titleName,
          formatNumber(result.chapterCount),
          formatNumber(result.sectionsWritten),
          formatNumber(result.totalTokenEstimate),
          formatDuration(elapsed),
        ];
      }
    });

    // Totals row
    if (granularity === "title") {
      tableRows.push([
        chalk.bold("Total"),
        "",
        chalk.bold(formatNumber(totalTokens)),
        chalk.bold(formatDuration(totalElapsed)),
      ]);
    } else if (granularity === "chapter") {
      tableRows.push([
        chalk.bold("Total"),
        "",
        chalk.bold(formatNumber(totalChapters)),
        chalk.bold(formatNumber(totalTokens)),
        chalk.bold(formatDuration(totalElapsed)),
      ]);
    } else {
      tableRows.push([
        chalk.bold("Total"),
        "",
        chalk.bold(formatNumber(totalChapters)),
        chalk.bold(formatNumber(totalSections)),
        chalk.bold(formatNumber(totalTokens)),
        chalk.bold(formatDuration(totalElapsed)),
      ]);
    }

    // Table headers and footer — adapt to granularity
    const tableHeaders =
      granularity === "title"
        ? ["Title", "Name", "Tokens", "Duration"]
        : granularity === "chapter"
          ? ["Title", "Name", "Chapters", "Tokens", "Duration"]
          : ["Title", "Name", "Chapters", "Sections", "Tokens", "Duration"];

    console.log(dataTable(tableHeaders, tableRows));

    // Footer — show the primary unit that was converted
    let countLabel: string;
    if (granularity === "title") {
      const titleWord = totalTitles === 1 ? "title" : "titles";
      countLabel = `${formatNumber(totalTitles)} ${titleWord}`;
    } else if (granularity === "chapter") {
      const chapterWord = totalChapters === 1 ? "chapter" : "chapters";
      countLabel = `${formatNumber(totalChapters)} ${chapterWord}`;
    } else {
      const sectionWord = totalSections === 1 ? "section" : "sections";
      countLabel = `${formatNumber(totalSections)} ${sectionWord}`;
    }
    console.log(`\n  ${success(`Converted ${countLabel} in ${formatDuration(totalElapsed)}`)}`);
    console.log("");
  });
