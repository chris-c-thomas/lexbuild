/**
 * `lexbuild convert-ecfr` command — converts eCFR XML files to Markdown.
 */

import chalk from "chalk";
import { Command, Option } from "commander";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { convertEcfrTitle } from "@lexbuild/ecfr";
import type { EcfrConvertOptions, EcfrConvertResult } from "@lexbuild/ecfr";
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

/** Parsed options from the convert-ecfr command */
interface ConvertEcfrCommandOptions {
  output: string;
  titles?: string | undefined;
  all: boolean;
  inputDir: string;
  granularity: "section" | "part" | "chapter" | "title";
  granularities?: string | undefined;
  outputSection?: string | undefined;
  outputPart?: string | undefined;
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
  currencyDate?: string | undefined;
}

type EcfrGranularityName = "section" | "part" | "chapter" | "title";

/**
 * Parse `--granularities` list and pair with per-granularity output flags.
 *
 * Exported for unit testing. Rejects unknown granularity names, duplicate
 * entries, and missing matching `--output-<g>` flags.
 */
export function parseEcfrGranularityList(
  options: ConvertEcfrCommandOptions,
): Array<{ granularity: EcfrGranularityName; output: string }> {
  const spec = (options.granularities ?? "").trim();
  if (!spec) return [];
  const names = spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const valid: ReadonlySet<string> = new Set(["section", "part", "chapter", "title"]);
  const seen = new Set<string>();
  const pairs: Array<{ granularity: EcfrGranularityName; output: string }> = [];
  for (const name of names) {
    if (!valid.has(name)) {
      throw new Error(`Unknown granularity "${name}". Choose from section, part, chapter, title.`);
    }
    if (seen.has(name)) {
      throw new Error(`Duplicate granularity "${name}" in --granularities list.`);
    }
    seen.add(name);
    const g = name as EcfrGranularityName;
    const out =
      g === "section"
        ? (options.outputSection ?? options.output)
        : g === "part"
          ? options.outputPart
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

/** Build EcfrConvertOptions from CLI flags. */
function buildConvertOptions(
  inputPath: string,
  outputPath: string,
  options: ConvertEcfrCommandOptions,
): EcfrConvertOptions {
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
    currencyDate: options.currencyDate,
  };

  const multi = parseEcfrGranularityList(options);
  if (multi.length > 0) {
    return { ...base, granularities: multi };
  }

  return {
    ...base,
    output: outputPath,
    granularity: options.granularity,
  };
}

/** Regex matching eCFR XML filenames like ECFR-title1.xml, ECFR-title17.xml */
const ECFR_XML_RE = /^ECFR-title(\d+)\.xml$/;

/** Resolve the XML file path for a given eCFR title number. */
function titleXmlPath(inputDir: string, titleNum: number): string {
  return join(inputDir, `ECFR-title${titleNum}.xml`);
}

/** Scan a directory for eCFR XML files and return their title numbers, sorted. */
function discoverEcfrTitles(inputDir: string): number[] {
  if (!existsSync(inputDir)) return [];

  return readdirSync(inputDir)
    .map((name) => ECFR_XML_RE.exec(name))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => parseInt(m[1] ?? "0", 10))
    .sort((a, b) => a - b);
}

/** Result from running a conversion including elapsed time. */
interface ConversionRun {
  /** One entry per granularity produced (length 1 for single-granularity mode). */
  results: EcfrConvertResult[];
  elapsed: number;
}

/** Run a conversion without printing output. */
async function runConversion(
  inputPath: string,
  outputPath: string,
  options: ConvertEcfrCommandOptions,
): Promise<ConversionRun> {
  const startTime = performance.now();
  const opts = buildConvertOptions(inputPath, outputPath, options);
  // Narrow on the discriminant so each overload is called with its exact
  // input type — no casts, and the return type is concrete per branch.
  const results: EcfrConvertResult[] =
    opts.granularities !== undefined ? await convertEcfrTitle(opts) : [await convertEcfrTitle(opts)];
  const elapsed = performance.now() - startTime;
  return { results, elapsed };
}

/** Convert a single file and print its detailed summary. */
async function convertSingleFile(
  inputPath: string,
  outputPath: string,
  options: ConvertEcfrCommandOptions,
  spinnerLabel: string,
) {
  const spinner = createSpinner(spinnerLabel);
  spinner.start();

  try {
    const { results, elapsed } = await runConversion(inputPath, outputPath, options);
    spinner.stop();

    // Use the first result as the primary display subject; other granularities
    // are shown as additional Output rows. runConversion guarantees the array
    // is non-empty.
    const [result] = results;
    if (!result) throw new Error("convertEcfrTitle produced no result");
    const rows: Array<[string, string]> = [];
    if (result.granularity === "section") {
      rows.push(["Sections", formatNumber(result.sectionsWritten)]);
      rows.push(["Parts", formatNumber(result.partCount)]);
    } else if (result.granularity === "part") {
      rows.push(["Parts", formatNumber(result.partCount)]);
    } else if (result.granularity === "chapter") {
      rows.push(["Chapters", formatNumber(result.sectionsWritten)]);
    }
    rows.push(["Est. Tokens", formatNumber(result.totalTokenEstimate)]);

    if (!result.dryRun) {
      rows.push(["Files Written", formatNumber(result.files.length)]);
    }

    rows.push(["Peak Memory", formatBytes(result.peakMemoryBytes)], ["Duration", formatDuration(elapsed)]);

    const titleLabel = result.dryRun
      ? `lexbuild — eCFR Title ${result.titleNumber}: ${result.titleName} [dry-run]`
      : `lexbuild — eCFR Title ${result.titleNumber}: ${result.titleName}`;

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

export const convertEcfrCommand = new Command("convert-ecfr")
  .description("Convert eCFR XML file(s) to Markdown")
  .argument("[input]", "Path to an eCFR XML file")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("--titles <spec>", "Title(s) to convert: 1, 1-5, or 1-5,17")
  .option("--all", "Convert all downloaded eCFR titles found in --input-dir", false)
  .option("-i, --input-dir <dir>", "Directory containing eCFR XML files", "./downloads/ecfr/xml")
  .addOption(
    new Option("-g, --granularity <level>", "Output granularity: section, part, chapter, or title")
      .choices(["section", "part", "chapter", "title"])
      .default("section"),
  )
  .option(
    "--granularities <list>",
    "Comma-separated granularities (e.g. section,part,chapter,title) — mutually exclusive with -g. Each listed granularity must have a matching --output or --output-<g> flag.",
  )
  .option("--output-section <dir>", "Output directory for section granularity (defaults to --output)")
  .option("--output-part <dir>", "Output directory for part granularity")
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
  .option("--include-statutory-notes", "Include statutory/regulatory notes only", false)
  .option("--include-amendments", "Include amendment history notes only", false)
  .option("--dry-run", "Parse and report structure without writing files", false)
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("--currency-date <YYYY-MM-DD>", "Currency date for frontmatter (default: today)")
  .addHelpText(
    "after",
    `
Input modes (use exactly one):
  <input>       Convert a single eCFR XML file
  --titles      Convert specific titles by number
  --all         Convert all titles in --input-dir

Granularity:
  section       One .md file per section (default)
  part          One .md file per part, sections inlined
  chapter       One .md file per chapter, parts and sections inlined
  title         One .md file per title, entire hierarchy inlined

Examples:
  $ lexbuild convert-ecfr --titles 1                    Convert eCFR Title 1
  $ lexbuild convert-ecfr --titles 1-5,17               Convert specific titles
  $ lexbuild convert-ecfr --all -g part                 All titles, part-level
  $ lexbuild convert-ecfr --all --dry-run               Preview stats only
  $ lexbuild convert-ecfr ./downloads/ecfr/xml/ECFR-title1.xml -o ./out`,
  )
  .action(async function action(this: Command, input: string | undefined, options: ConvertEcfrCommandOptions) {
    const modeCount = [input, options.titles, options.all].filter(Boolean).length;
    if (modeCount === 0) {
      console.error(error("Specify an input file, --titles <spec>, or --all (e.g. --titles 1-5,17)"));
      process.exit(1);
    }
    if (modeCount > 1) {
      console.error(error("Cannot combine <input>, --titles, and --all — use only one"));
      process.exit(1);
    }

    if (options.granularities !== undefined && this.getOptionValueSource("granularity") === "cli") {
      console.error(error("Cannot combine --granularity and --granularities — use one or the other"));
      process.exit(1);
    }

    const outputPath = resolve(options.output);
    const dryRunLabel = options.dryRun ? " [dry-run]" : "";

    // Single-file mode
    if (input) {
      const inputPath = resolve(input);
      if (!existsSync(inputPath)) {
        console.error(error(`Input file not found: ${inputPath}`));
        process.exit(1);
      }
      await convertSingleFile(inputPath, outputPath, options, `Converting eCFR${dryRunLabel}...`);
      return;
    }

    // Multi-title mode
    let titles: number[];
    if (options.all) {
      const inputDir = resolve(options.inputDir);
      titles = discoverEcfrTitles(inputDir);
      if (titles.length === 0) {
        console.error(error(`No eCFR XML files found in ${inputDir}`));
        process.exit(1);
      }
    } else {
      const titlesSpec = options.titles as string;
      try {
        titles = parseTitles(titlesSpec, 50);
      } catch (err) {
        console.error(error(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
    }

    const inputDir = resolve(options.inputDir);
    const totalTitles = titles.length;
    const results: ConversionRun[] = [];

    const spinner = createSpinner(`Converting eCFR${dryRunLabel}...`);
    spinner.start();

    for (const [i, titleNum] of titles.entries()) {
      const xmlPath = titleXmlPath(inputDir, titleNum);

      if (!existsSync(xmlPath)) {
        spinner.stop();
        console.error(error(`XML file not found: ${xmlPath}`));
        process.exit(1);
      }

      spinner.text = `Converting eCFR Title ${titleNum}${dryRunLabel} (${i + 1}/${totalTitles})...`;

      try {
        const run = await runConversion(xmlPath, outputPath, options);
        results.push(run);
      } catch (err) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }

    spinner.stop();

    const outputRelative = relative(process.cwd(), outputPath) || outputPath;
    const headerTitle = options.dryRun
      ? "lexbuild — eCFR Conversion Summary [dry-run]"
      : "lexbuild — eCFR Conversion Summary";

    // In multi-granularity mode the per-granularity output dirs carry more
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

    // Primary granularity drives the table column layout.
    const granularity = (firstRun?.results[0]?.granularity ?? options.granularity) as
      | "section"
      | "part"
      | "chapter"
      | "title";
    let totalSections = 0;
    let totalParts = 0;
    let totalTokens = 0;
    let totalElapsed = 0;

    const tableRows = results.map(({ results: runResults, elapsed }) => {
      const [result] = runResults;
      if (!result) throw new Error("convertEcfrTitle produced no result");
      totalSections += result.sectionsWritten;
      totalParts += result.partCount;
      totalTokens += result.totalTokenEstimate;
      totalElapsed += elapsed;

      if (granularity === "title") {
        return [result.titleNumber, result.titleName, formatNumber(result.totalTokenEstimate), formatDuration(elapsed)];
      } else if (granularity === "chapter") {
        return [
          result.titleNumber,
          result.titleName,
          formatNumber(result.sectionsWritten),
          formatNumber(result.totalTokenEstimate),
          formatDuration(elapsed),
        ];
      } else if (granularity === "part") {
        return [
          result.titleNumber,
          result.titleName,
          formatNumber(result.partCount),
          formatNumber(result.totalTokenEstimate),
          formatDuration(elapsed),
        ];
      } else {
        return [
          result.titleNumber,
          result.titleName,
          formatNumber(result.partCount),
          formatNumber(result.sectionsWritten),
          formatNumber(result.totalTokenEstimate),
          formatDuration(elapsed),
        ];
      }
    });

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
        chalk.bold(formatNumber(totalSections)),
        chalk.bold(formatNumber(totalTokens)),
        chalk.bold(formatDuration(totalElapsed)),
      ]);
    } else if (granularity === "part") {
      tableRows.push([
        chalk.bold("Total"),
        "",
        chalk.bold(formatNumber(totalParts)),
        chalk.bold(formatNumber(totalTokens)),
        chalk.bold(formatDuration(totalElapsed)),
      ]);
    } else {
      tableRows.push([
        chalk.bold("Total"),
        "",
        chalk.bold(formatNumber(totalParts)),
        chalk.bold(formatNumber(totalSections)),
        chalk.bold(formatNumber(totalTokens)),
        chalk.bold(formatDuration(totalElapsed)),
      ]);
    }

    const tableHeaders =
      granularity === "title"
        ? ["Title", "Name", "Tokens", "Duration"]
        : granularity === "chapter"
          ? ["Title", "Name", "Chapters", "Tokens", "Duration"]
          : granularity === "part"
            ? ["Title", "Name", "Parts", "Tokens", "Duration"]
            : ["Title", "Name", "Parts", "Sections", "Tokens", "Duration"];

    console.log(dataTable(tableHeaders, tableRows));

    // Footer — show the primary unit that was converted
    let countLabel: string;
    if (granularity === "title") {
      const titleWord = totalTitles === 1 ? "title" : "titles";
      countLabel = `${formatNumber(totalTitles)} ${titleWord}`;
    } else if (granularity === "chapter") {
      const chapterWord = totalSections === 1 ? "chapter" : "chapters";
      countLabel = `${formatNumber(totalSections)} ${chapterWord}`;
    } else if (granularity === "part") {
      const partWord = totalParts === 1 ? "part" : "parts";
      countLabel = `${formatNumber(totalParts)} ${partWord}`;
    } else {
      const sectionWord = totalSections === 1 ? "section" : "sections";
      countLabel = `${formatNumber(totalSections)} ${sectionWord}`;
    }
    console.log(`\n  ${success(`Converted ${countLabel} in ${formatDuration(totalElapsed)}`)}`);
    console.log("");
  });
