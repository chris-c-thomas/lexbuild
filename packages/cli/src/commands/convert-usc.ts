/**
 * `lexbuild convert-usc` command — converts USC XML files to Markdown.
 */

import chalk from "chalk";
import { Command, Option } from "commander";
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { convertTitle } from "@lexbuild/usc";
import type { ConvertOptions, ConvertResult } from "@lexbuild/usc";
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
  granularities?: string | undefined;
  outputSection?: string | undefined;
  outputChapter?: string | undefined;
  outputTitle?: string | undefined;
  linkStyle: "relative" | "canonical" | "plaintext";
  includeSourceCredits: boolean;
  includeNotes: boolean;
  includeEditorialNotes: boolean;
  includeStatutoryNotes: boolean;
  includeAmendments: boolean;
  dryRun: boolean;
  verbose: boolean;
}

type UscGranularity = "section" | "chapter" | "title";

/**
 * Parse `--granularities` list and pair with per-granularity output flags.
 *
 * Exported for unit testing. Rejects unknown granularity names, duplicate
 * entries, and missing matching `--output-<g>` flags.
 */
export function parseGranularityList(
  options: ConvertCommandOptions,
): Array<{ granularity: UscGranularity; output: string }> {
  const spec = (options.granularities ?? "").trim();
  if (!spec) return [];
  const names = spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const valid: ReadonlySet<string> = new Set(["section", "chapter", "title"]);
  const seen = new Set<string>();
  const pairs: Array<{ granularity: UscGranularity; output: string }> = [];
  for (const name of names) {
    if (!valid.has(name)) {
      throw new Error(`Unknown granularity "${name}". Choose from section, chapter, title.`);
    }
    if (seen.has(name)) {
      throw new Error(`Duplicate granularity "${name}" in --granularities list.`);
    }
    seen.add(name);
    const g = name as UscGranularity;
    // Section uses `-o/--output` for back-compat; others take `--output-<g>`.
    const out =
      g === "section"
        ? (options.outputSection ?? options.output)
        : g === "chapter"
          ? options.outputChapter
          : options.outputTitle;
    if (!out) {
      const flag = g === "section" ? "--output" : `--output-${g}`;
      throw new Error(`Missing ${flag} for granularity "${g}".`);
    }
    pairs.push({ granularity: g, output: resolve(out) });
  }
  return pairs;
}

/** Build the shared convert options from CLI flags. */
function buildConvertOptions(inputPath: string, outputPath: string, options: ConvertCommandOptions): ConvertOptions {
  const hasSelectiveFlags = options.includeEditorialNotes || options.includeStatutoryNotes || options.includeAmendments;
  const includeNotes = hasSelectiveFlags ? false : options.includeNotes;

  const base = {
    input: inputPath,
    linkStyle: options.linkStyle,
    includeSourceCredits: options.includeSourceCredits,
    includeNotes,
    includeEditorialNotes: options.includeEditorialNotes,
    includeStatutoryNotes: options.includeStatutoryNotes,
    includeAmendments: options.includeAmendments,
    dryRun: options.dryRun,
  };

  const multi = parseGranularityList(options);
  if (multi.length > 0) {
    return { ...base, granularities: multi };
  }

  return {
    ...base,
    output: outputPath,
    granularity: options.granularity,
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
  /** One entry per granularity produced (length 1 for single-granularity mode). */
  results: ConvertResult[];
  elapsed: number;
}

/** Run a conversion without printing output. Returns the results and elapsed time. */
async function runConversion(
  inputPath: string,
  outputPath: string,
  options: ConvertCommandOptions,
): Promise<ConversionRun> {
  const startTime = performance.now();
  const opts = buildConvertOptions(inputPath, outputPath, options);
  // Narrow on the discriminant so each overload is called with its exact
  // input type — no casts, and the return type is concrete per branch.
  const results: ConvertResult[] =
    opts.granularities !== undefined ? await convertTitle(opts) : [await convertTitle(opts)];
  const elapsed = performance.now() - startTime;
  return { results, elapsed };
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
    const { results, elapsed } = await runConversion(inputPath, outputPath, options);

    spinner.stop();

    // Use the first result as the primary display subject (section for multi,
    // or the single-granularity result otherwise). Additional granularities
    // are listed beneath as extra output rows. runConversion guarantees the
    // array is non-empty.
    const [result] = results;
    if (!result) throw new Error("convertTitle produced no result");
    const rows: Array<[string, string]> = [];
    if (result.granularity === "section") {
      rows.push(["Sections", formatNumber(result.sectionsWritten)]);
      rows.push(["Chapters", formatNumber(result.chapterCount)]);
    } else if (result.granularity === "chapter") {
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

    const outputRows: Array<[string, string]> = results.map((r) => {
      const rel = relative(process.cwd(), r.output) || r.output;
      return [results.length === 1 ? "Output" : `Output (${r.granularity})`, rel];
    });

    const output = summaryBlock({
      title: titleLabel,
      rows: [...rows, ...outputRows],
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
  .option(
    "--granularities <list>",
    "Comma-separated granularities (e.g. section,chapter,title) — mutually exclusive with -g. Each listed granularity must have a matching --output or --output-<g> flag.",
  )
  .option("--output-section <dir>", "Output directory for section granularity (defaults to --output)")
  .option("--output-chapter <dir>", "Output directory for chapter granularity")
  .option("--output-title <dir>", "Output directory for title granularity")
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
  .action(async function action(this: Command, input: string | undefined, options: ConvertCommandOptions) {
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

    // --granularity and --granularities are mutually exclusive (ignoring the
    // `-g section` default).
    if (options.granularities !== undefined && this.getOptionValueSource("granularity") === "cli") {
      console.error(error("Cannot combine --granularity and --granularities — use one or the other"));
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

    // In multi-granularity mode the per-granularity output dirs are richer
    // context than the single --output; show them all.
    const firstRun = results[0];
    const headerRows: Array<[string, string]> = [];
    if (firstRun && firstRun.results.length > 1) {
      for (const r of firstRun.results) {
        headerRows.push([`Output (${r.granularity})`, relative(process.cwd(), r.output) || r.output]);
      }
    } else {
      headerRows.push(["Directory", outputRelative]);
    }

    const header = summaryBlock({ title: headerTitle, rows: headerRows });
    process.stdout.write(header);

    // Build data table rows from the primary (first) result per title — the
    // column layout follows the primary granularity. In multi mode the other
    // granularities are surfaced via the header's Output rows above.
    const granularity = (firstRun?.results[0]?.granularity ?? options.granularity) as UscGranularity;
    let totalSections = 0;
    let totalChapters = 0;
    let totalTokens = 0;
    let totalElapsed = 0;

    const tableRows = results.map(({ results: runResults, elapsed }) => {
      const [result] = runResults;
      if (!result) throw new Error("convertTitle produced no result");
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
