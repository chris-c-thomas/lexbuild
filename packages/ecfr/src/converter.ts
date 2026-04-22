/**
 * eCFR conversion orchestrator.
 *
 * Follows the same collect-then-write pattern as the USC converter:
 * 1. Parse XML via SAX → feed EcfrASTBuilder (emitting at one or more levels)
 * 2. Collect emitted sections/parts/titles per level
 * 3. Two-pass link registration (section granularity)
 * 4. Write Markdown files, _meta.json, and README.md per requested granularity
 *
 * A single parse feeds all requested granularities, so emitting at multiple
 * levels in one call is the same work as emitting at just one.
 */

import { createReadStream } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import {
  XMLParser,
  renderDocument,
  createLinkResolver,
  FORMAT_VERSION,
  GENERATOR,
  writeFile,
  writeFileIfChanged,
  mkdir,
} from "@lexbuild/core";
import type {
  LevelNode,
  LevelType,
  EmitContext,
  RenderOptions,
  NotesFilter,
  ASTNode,
  AncestorInfo,
} from "@lexbuild/core";
import { EcfrASTBuilder } from "./ecfr-builder.js";
import { buildEcfrFrontmatter } from "./ecfr-frontmatter.js";
import { buildEcfrOutputPath, buildTitleDir } from "./ecfr-path.js";

/** eCFR output granularity */
export type EcfrGranularity = "section" | "part" | "chapter" | "title";

/** One (granularity, output) pair for multi-granularity conversion */
export interface EcfrGranularityOutput {
  granularity: EcfrGranularity;
  output: string;
}

/** Fields shared by single- and multi-granularity conversion options. */
export interface BaseEcfrConvertOptions {
  /** Path to input eCFR XML file */
  input: string;
  /** Link style for cross-references */
  linkStyle: "relative" | "canonical" | "plaintext";
  /** Include source credits in output */
  includeSourceCredits: boolean;
  /** Include all notes */
  includeNotes: boolean;
  /** Selectively include editorial notes */
  includeEditorialNotes: boolean;
  /** Selectively include statutory/regulatory notes */
  includeStatutoryNotes: boolean;
  /** Selectively include amendment history */
  includeAmendments: boolean;
  /** Parse only, don't write files */
  dryRun: boolean;
  /** Currency date (YYYY-MM-DD) from eCFR API metadata. Defaults to today if not provided. */
  currencyDate?: string | undefined;
}

/** Single-granularity mode: one output directory, one granularity. */
export interface SingleEcfrConvertOptions extends BaseEcfrConvertOptions {
  /** Output root directory. Required in single-granularity mode. */
  output: string;
  /** Output granularity. Defaults to `"section"` when omitted. */
  granularity?: EcfrGranularity | undefined;
  /** @internal — must not be set in single-granularity mode */
  granularities?: undefined;
}

/**
 * Multi-granularity mode: a set of `{granularity, output}` pairs emitted from
 * one parse.
 *
 * The builder emits at the set of unique `LevelType`s needed to satisfy the
 * requested granularities. `section` and `chapter` both emit at the section
 * level — chapter output is synthesized from the section bucket at write
 * time (by grouping sections under their chapter ancestor). `part` and
 * `title` each emit at their own level.
 */
export interface MultiEcfrConvertOptions extends BaseEcfrConvertOptions {
  /** Multiple `{granularity, output}` pairs to produce in a single parse. */
  granularities: readonly EcfrGranularityOutput[];
  /** @internal — must not be set in multi-granularity mode */
  output?: undefined;
  /** @internal — must not be set in multi-granularity mode */
  granularity?: undefined;
}

/**
 * Options for converting an eCFR XML file.
 *
 * Discriminated union: pass either `output` (+ optional `granularity`) for
 * single-granularity output, or `granularities` for multi-granularity output
 * from a single parse. The two modes are mutually exclusive at the type level.
 */
export type EcfrConvertOptions = SingleEcfrConvertOptions | MultiEcfrConvertOptions;

/** Result of an eCFR conversion */
export interface EcfrConvertResult {
  /** Number of sections/parts/titles written */
  sectionsWritten: number;
  /** Paths of written files */
  files: string[];
  /** Title number from XML metadata */
  titleNumber: string;
  /** Title name from XML metadata */
  titleName: string;
  /** Whether this was a dry run */
  dryRun: boolean;
  /** Number of unique parts */
  partCount: number;
  /** Total estimated tokens */
  totalTokenEstimate: number;
  /** Peak RSS in bytes during conversion */
  peakMemoryBytes: number;
  /** Granularity this result corresponds to */
  granularity: EcfrGranularity;
  /** Output directory this result was written to */
  output: string;
}

/** Internal collected section data */
interface CollectedSection {
  node: LevelNode;
  context: EmitContext;
}

/** Internal section metadata for _meta.json */
interface SectionMeta {
  identifier: string;
  number: string;
  name: string;
  fileName: string;
  relativeFile: string;
  contentLength: number;
  hasNotes: boolean;
  status: string;
  partIdentifier: string;
  partNumber: string;
  partName: string;
}

/** Map a granularity to the LevelType the builder must emit. */
function emitLevelFor(granularity: EcfrGranularity): LevelType {
  if (granularity === "title") return "title";
  if (granularity === "part") return "part";
  // Both "section" and "chapter" emit at section — chapter groups sections at write time.
  return "section";
}

/** Resolve the normalized granularity list from options. */
function resolveGranularities(options: EcfrConvertOptions): EcfrGranularityOutput[] {
  const hasMulti = options.granularities !== undefined;
  const hasSingle = options.granularity !== undefined || options.output !== undefined;

  if (hasMulti && hasSingle) {
    throw new Error(
      "convertEcfrTitle: `granularities` is mutually exclusive with `granularity`/`output`",
    );
  }

  if (hasMulti) {
    const list = options.granularities ?? [];
    if (list.length === 0) {
      throw new Error("convertEcfrTitle: `granularities` must contain at least one entry");
    }
    const seen = new Set<EcfrGranularity>();
    for (const entry of list) {
      if (seen.has(entry.granularity)) {
        throw new Error(
          `convertEcfrTitle: duplicate granularity "${entry.granularity}" in \`granularities\``,
        );
      }
      seen.add(entry.granularity);
    }
    return [...list];
  }

  const granularity = options.granularity ?? "section";
  const output = options.output;
  if (output === undefined) {
    throw new Error("convertEcfrTitle: `output` is required in single-granularity mode");
  }
  return [{ granularity, output }];
}

/**
 * Convert an eCFR XML file to structured Markdown.
 *
 * - Single-granularity mode (`output` + optional `granularity`) returns one `EcfrConvertResult`.
 * - Multi-granularity mode (`granularities`) parses once and returns one result per entry.
 */
export async function convertEcfrTitle(
  options: MultiEcfrConvertOptions,
): Promise<EcfrConvertResult[]>;
export async function convertEcfrTitle(
  options: SingleEcfrConvertOptions,
): Promise<EcfrConvertResult>;
export async function convertEcfrTitle(
  options: EcfrConvertOptions,
): Promise<EcfrConvertResult | EcfrConvertResult[]> {
  const granularityList = resolveGranularities(options);

  // Build the emit set as the union of levels needed across requested granularities.
  const emitSet = new Set<LevelType>();
  for (const g of granularityList) emitSet.add(emitLevelFor(g.granularity));

  // --- Parse phase (single pass) ---
  let peakMemory = process.memoryUsage().rss;
  const collectedByLevel = new Map<LevelType, CollectedSection[]>();
  for (const lt of emitSet) collectedByLevel.set(lt, []);

  const builder = new EcfrASTBuilder({
    emitAt: emitSet,
    onEmit: (node, context) => {
      const bucket = collectedByLevel.get(node.levelType);
      if (bucket) bucket.push({ node, context });
    },
  });

  const parser = new XMLParser({ defaultNamespace: "" });
  parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
  parser.on("closeElement", (name) => builder.onCloseElement(name));
  parser.on("text", (text) => builder.onText(text));

  const stream = createReadStream(options.input, "utf-8");
  await parser.parseStream(stream);

  const postParseRss = process.memoryUsage().rss;
  if (postParseRss > peakMemory) peakMemory = postParseRss;

  const partNotes = builder.getPartNotes();

  // Extract title info from any collected node (prefer section for its ancestor chain).
  const { titleNumber, titleName } = extractTitleInfo(collectedByLevel);

  // --- Write phase (per requested granularity, reusing the same buckets) ---
  const results: EcfrConvertResult[] = [];
  for (const { granularity, output } of granularityList) {
    const bucket = collectedByLevel.get(emitLevelFor(granularity)) ?? [];
    const result = await writeGranularity({
      granularity,
      output,
      options,
      collected: bucket,
      partNotes,
      titleNumber,
      titleName,
    });
    if (result.peakMemoryBytes > peakMemory) peakMemory = result.peakMemoryBytes;
    result.peakMemoryBytes = peakMemory;
    results.push(result);
  }

  if (options.granularities !== undefined) return results;
  const [first] = results;
  if (!first) throw new Error("convertEcfrTitle: no conversion result produced");
  return first;
}

/**
 * Extract title number and name from the first available collected node.
 *
 * Falls back to `{"0", ""}` when no emitted node has a title ancestor and no
 * title-level node was emitted. That path produces `/us/cfr/t0/...` canonical
 * identifiers, which is almost always a sign of malformed source XML — we
 * warn rather than silently corrupt downstream data.
 */
function extractTitleInfo(collectedByLevel: Map<LevelType, CollectedSection[]>): {
  titleNumber: string;
  titleName: string;
} {
  // Prefer section emissions (richest ancestor chain), fall back to others.
  const probeOrder: LevelType[] = ["section", "part", "chapter", "title"];
  for (const lt of probeOrder) {
    const bucket = collectedByLevel.get(lt);
    const first = bucket?.[0];
    if (!first) continue;
    const titleAncestor = first.context.ancestors.find((a) => a.levelType === "title");
    if (titleAncestor) {
      return {
        titleNumber: titleAncestor.numValue ?? "0",
        titleName: titleAncestor.heading ?? first.context.documentMeta.dcTitle ?? "",
      };
    }
    if (first.node.levelType === "title") {
      return {
        titleNumber: first.node.numValue ?? "0",
        titleName: first.node.heading ?? first.context.documentMeta.dcTitle ?? "",
      };
    }
  }

  console.warn(
    "[@lexbuild/ecfr] convertEcfrTitle: could not resolve title number from emitted nodes; " +
      "output will use `/us/cfr/t0/...` identifiers. Source XML likely missing a DIV1 TYPE=\"TITLE\".",
  );
  return { titleNumber: "0", titleName: "" };
}

interface WriteGranularityArgs {
  granularity: EcfrGranularity;
  output: string;
  options: EcfrConvertOptions;
  collected: CollectedSection[];
  partNotes: ReadonlyMap<string, { authority?: string | undefined; regulatorySource?: string | undefined }>;
  titleNumber: string;
  titleName: string;
}

/** Write one granularity's outputs from its pre-collected bucket. */
async function writeGranularity(args: WriteGranularityArgs): Promise<EcfrConvertResult> {
  const { granularity, output, options, collected, partNotes, titleNumber, titleName } = args;
  let peakMemory = process.memoryUsage().rss;

  const notesFilter = buildNotesFilter(options);
  const renderOpts: RenderOptions = {
    headingOffset: 0,
    linkStyle: options.linkStyle,
    notesFilter,
  };

  if (options.dryRun) {
    return buildDryRunResult(collected, granularity, output, titleNumber, titleName, peakMemory);
  }

  if (granularity === "section") {
    return writeSectionGranularity({
      collected,
      output,
      options,
      renderOpts,
      partNotes,
      titleNumber,
      titleName,
      peakMemory,
    });
  }

  // Chapter, part, or title granularity
  const files: string[] = [];
  let totalLength = 0;

  if (granularity === "chapter") {
    // Group emitted sections by chapter ancestor, render each chapter as a composite document.
    const chapterMap = new Map<
      string,
      { sections: CollectedSection[]; chapterAncestor: AncestorInfo; firstContext: EmitContext }
    >();

    let skippedRootless = 0;
    for (const item of collected) {
      const chapterAnc = item.context.ancestors.find((a) => a.levelType === "chapter");
      if (!chapterAnc?.numValue) {
        // Section without a chapter ancestor cannot be placed in a chapter
        // file. Rare in eCFR (e.g. parts directly under subtitle with no
        // surrounding chapter). Drop rather than synthesize a junk filename.
        skippedRootless++;
        continue;
      }
      const existing = chapterMap.get(chapterAnc.numValue);
      if (existing) {
        existing.sections.push(item);
      } else {
        chapterMap.set(chapterAnc.numValue, {
          sections: [item],
          chapterAncestor: chapterAnc,
          firstContext: item.context,
        });
      }
    }
    if (skippedRootless > 0) {
      console.warn(
        `[@lexbuild/ecfr] convertEcfrTitle: chapter granularity skipped ${skippedRootless} section(s) with no chapter ancestor`,
      );
    }

    for (const [_chapterKey, { sections, chapterAncestor, firstContext }] of chapterMap) {
      const chapterNode: LevelNode = {
        type: "level",
        levelType: "chapter",
        num: chapterAncestor.numValue,
        numValue: chapterAncestor.numValue,
        heading: chapterAncestor.heading,
        identifier: chapterAncestor.identifier,
        children: sections.map((s) => s.node),
      };

      const frontmatter = buildEcfrFrontmatter(chapterNode, firstContext, options.currencyDate);
      const markdown = renderDocument(chapterNode, frontmatter, renderOpts);

      const filePath = buildEcfrOutputPath(chapterNode, firstContext, output);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFileIfChanged(filePath, markdown, "utf-8");
      files.push(filePath);
      totalLength += markdown.length;
    }
  } else {
    // Part or title granularity — each emitted node is written as-is.
    for (const { node, context } of collected) {
      const frontmatter = buildEcfrFrontmatter(node, context, options.currencyDate);
      const markdown = renderDocument(node, frontmatter, renderOpts);

      const filePath = buildEcfrOutputPath(node, context, output);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFileIfChanged(filePath, markdown, "utf-8");
      files.push(filePath);
      totalLength += markdown.length;
    }
  }

  const currentRss = process.memoryUsage().rss;
  if (currentRss > peakMemory) peakMemory = currentRss;

  const partCount =
    granularity === "part"
      ? files.length
      : granularity === "chapter"
        ? new Set(
            collected
              .map((c) => c.context.ancestors.find((a) => a.levelType === "part")?.numValue)
              .filter(Boolean),
          ).size
        : 0;

  return {
    sectionsWritten: files.length,
    files,
    titleNumber,
    titleName,
    dryRun: false,
    partCount,
    totalTokenEstimate: Math.ceil(totalLength / 4),
    peakMemoryBytes: peakMemory,
    granularity,
    output,
  };
}

interface SectionWriteArgs {
  collected: CollectedSection[];
  output: string;
  options: EcfrConvertOptions;
  renderOpts: RenderOptions;
  partNotes: ReadonlyMap<string, { authority?: string | undefined; regulatorySource?: string | undefined }>;
  titleNumber: string;
  titleName: string;
  peakMemory: number;
}

async function writeSectionGranularity(args: SectionWriteArgs): Promise<EcfrConvertResult> {
  const { collected, output, options, renderOpts, partNotes, titleNumber, titleName } = args;
  let peakMemory = args.peakMemory;

  const linkResolver = createLinkResolver();
  const sectionMetas: SectionMeta[] = [];

  // Pass 1: compute output paths, detect duplicates, register identifiers.
  const counts = new Map<string, number>();
  for (const { node, context } of collected) {
    const partNum = context.ancestors.find((a) => a.levelType === "part")?.numValue ?? "__root__";
    const secNum = node.numValue ?? "0";
    const key = `${partNum}/${secNum}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const outputPaths: string[] = [];

  for (const { node, context } of collected) {
    const partNum = context.ancestors.find((a) => a.levelType === "part")?.numValue ?? "__root__";
    const secNum = node.numValue ?? "0";
    const key = `${partNum}/${secNum}`;
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);

    const total = counts.get(key) ?? 1;
    const suffix = total > 1 && occurrence > 1 ? `-${occurrence}` : "";

    const filePath = buildEcfrOutputPath(node, context, output);
    const suffixedPath = suffix ? filePath.replace(/\.md$/, `${suffix}.md`) : filePath;
    outputPaths.push(suffixedPath);

    if (node.identifier && occurrence === 1) {
      linkResolver.register(node.identifier, suffixedPath);
    }
  }

  // Pass 2: render and write.
  for (let i = 0; i < collected.length; i++) {
    const item = collected[i];
    const suffixedPath = outputPaths[i];
    if (!item || !suffixedPath) continue;
    const { node, context } = item;

    const frontmatter = buildEcfrFrontmatter(node, context, options.currencyDate);
    const partId = context.ancestors.find((a) => a.levelType === "part")?.identifier;
    if (partId && (!frontmatter.authority || !frontmatter.regulatory_source)) {
      const partNoteData = partNotes.get(partId);
      if (partNoteData) {
        if (!frontmatter.authority && partNoteData.authority) {
          frontmatter.authority = partNoteData.authority;
        }
        if (!frontmatter.regulatory_source && partNoteData.regulatorySource) {
          frontmatter.regulatory_source = partNoteData.regulatorySource;
        }
      }
    }

    const fromFile = suffixedPath;
    const markdown = renderDocument(node, frontmatter, {
      ...renderOpts,
      resolveLink: (identifier: string) => linkResolver.resolve(identifier, fromFile),
    });

    await mkdir(dirname(suffixedPath), { recursive: true });
    await writeFileIfChanged(suffixedPath, markdown, "utf-8");

    const hasNotes = node.children.some((c) => c.type === "note" || c.type === "notesContainer");
    const secNum = node.numValue ?? "0";
    const partNum = context.ancestors.find((a) => a.levelType === "part")?.numValue ?? "__root__";

    sectionMetas.push({
      identifier: node.identifier ?? `/us/cfr/t${titleNumber}/s${secNum}`,
      number: secNum,
      name: node.heading?.trim() ?? "",
      fileName: basename(suffixedPath),
      relativeFile: relative(buildTitleDir(titleNumber, output), suffixedPath),
      contentLength: markdown.length,
      hasNotes,
      status: node.status ?? "current",
      partIdentifier: context.ancestors.find((a) => a.levelType === "part")?.identifier ?? "",
      partNumber: partNum,
      partName: context.ancestors.find((a) => a.levelType === "part")?.heading?.trim() ?? "",
    });

    const currentRss = process.memoryUsage().rss;
    if (currentRss > peakMemory) peakMemory = currentRss;
  }

  await writeMetaFiles(
    sectionMetas,
    titleNumber,
    titleName,
    output,
    "section",
    options.input,
    options.currencyDate,
  );

  const files = sectionMetas.map((m) => join(buildTitleDir(titleNumber, output), m.relativeFile));

  return {
    sectionsWritten: sectionMetas.length,
    files,
    titleNumber,
    titleName,
    dryRun: false,
    partCount: new Set(sectionMetas.map((s) => s.partNumber)).size,
    totalTokenEstimate: Math.ceil(sectionMetas.reduce((sum, m) => sum + m.contentLength, 0) / 4),
    peakMemoryBytes: peakMemory,
    granularity: "section",
    output,
  };
}

function buildDryRunResult(
  collected: CollectedSection[],
  granularity: EcfrGranularity,
  output: string,
  titleNumber: string,
  titleName: string,
  peakMemory: number,
): EcfrConvertResult {
  let totalEstimate = 0;
  let count: number;

  if (granularity === "chapter") {
    // Mirror the write-phase filter: sections with no chapter ancestor
    // would be dropped rather than grouped under a synthetic key.
    const chapterKeys = new Set<string>();
    for (const { node, context } of collected) {
      const chapterAnc = context.ancestors.find((a) => a.levelType === "chapter");
      if (!chapterAnc?.numValue) continue;
      chapterKeys.add(chapterAnc.numValue);
      totalEstimate += estimateTokens(node);
    }
    count = chapterKeys.size;
  } else {
    // section/part/title: each collected item of the matching level is a file
    count = collected.length;
    for (const { node } of collected) {
      totalEstimate += estimateTokens(node);
    }
  }

  return {
    sectionsWritten: count,
    files: [],
    titleNumber,
    titleName,
    dryRun: true,
    partCount: 0,
    totalTokenEstimate: totalEstimate,
    peakMemoryBytes: peakMemory,
    granularity,
    output,
  };
}

function estimateTokens(node: LevelNode): number {
  let length = 0;

  function walk(n: ASTNode): void {
    if (n.type === "inline" && "text" in n && n.text) {
      length += (n.text as string).length;
    }
    if ("children" in n && Array.isArray(n.children)) {
      for (const child of n.children) {
        walk(child as ASTNode);
      }
    }
  }

  walk(node);
  return Math.ceil(length / 4);
}

function buildNotesFilter(options: EcfrConvertOptions): NotesFilter | undefined {
  if (options.includeNotes) return undefined;

  const hasSelective = options.includeEditorialNotes || options.includeStatutoryNotes || options.includeAmendments;

  if (!hasSelective) {
    return { editorial: false, statutory: false, amendments: false };
  }

  return {
    editorial: options.includeEditorialNotes,
    statutory: options.includeStatutoryNotes,
    amendments: options.includeAmendments,
  };
}

// --- Metadata file generation (_meta.json + README.md) ---

interface PartMeta {
  identifier: string;
  number: string;
  name: string;
  directory: string;
  sections: Array<{
    identifier: string;
    number: string;
    name: string;
    file: string;
    token_estimate: number;
    has_notes: boolean;
    status: string;
  }>;
}

/**
 * Write _meta.json and README.md files for the converted title.
 */
async function writeMetaFiles(
  sectionMetas: SectionMeta[],
  titleNumber: string,
  titleName: string,
  outputRoot: string,
  granularity: string,
  sourceXml: string,
  currencyDate?: string | undefined,
): Promise<void> {
  // Group sections by part
  const partMap = new Map<string, SectionMeta[]>();
  for (const meta of sectionMetas) {
    const key = meta.partNumber;
    const arr = partMap.get(key) ?? [];
    arr.push(meta);
    partMap.set(key, arr);
  }

  // Build part metas
  const parts: PartMeta[] = [];
  for (const [partNum, sections] of partMap) {
    const first = sections[0];
    if (!first) continue;
    parts.push({
      identifier: first.partIdentifier || `/us/cfr/t${titleNumber}/pt${partNum}`,
      number: partNum,
      name: first.partName,
      directory: `part-${partNum}`,
      sections: sections.map((s) => ({
        identifier: s.identifier,
        number: s.number,
        name: s.name,
        file: s.fileName,
        token_estimate: Math.ceil(s.contentLength / 4),
        has_notes: s.hasNotes,
        status: s.status,
      })),
    });
  }

  const titleDir = buildTitleDir(titleNumber, outputRoot);
  await mkdir(titleDir, { recursive: true });

  // Write part-level _meta.json files
  for (const part of parts) {
    const partDir = join(titleDir, getPartDirPath(sectionMetas, part.number));
    await mkdir(partDir, { recursive: true });

    const partMeta = {
      format_version: FORMAT_VERSION,
      identifier: part.identifier,
      part_number: part.number,
      part_name: part.name,
      title_number: parseInt(titleNumber, 10),
      section_count: part.sections.length,
      sections: part.sections,
    };

    await writeFile(join(partDir, "_meta.json"), JSON.stringify(partMeta, null, 2) + "\n", "utf-8");
  }

  // Write title-level _meta.json
  const totalTokens = sectionMetas.reduce((sum, m) => sum + m.contentLength, 0);
  const titleMeta = {
    format_version: FORMAT_VERSION,
    generator: GENERATOR,
    generated_at: new Date().toISOString(),
    identifier: `/us/cfr/t${titleNumber}`,
    title_number: parseInt(titleNumber, 10),
    title_name: titleName,
    source: "ecfr",
    legal_status: "authoritative_unofficial",
    currency: currencyDate ?? new Date().toISOString().slice(0, 10),
    source_xml: basename(sourceXml),
    granularity,
    stats: {
      part_count: parts.length,
      section_count: sectionMetas.length,
      total_files: sectionMetas.length,
      total_tokens_estimate: Math.ceil(totalTokens / 4),
    },
    parts,
  };

  await writeFile(join(titleDir, "_meta.json"), JSON.stringify(titleMeta, null, 2) + "\n", "utf-8");

  // Write README.md
  const readme = buildReadme(titleNumber, titleName, parts, sectionMetas, granularity);
  await writeFile(join(titleDir, "README.md"), readme, "utf-8");
}

/**
 * Determine the relative directory path for a part within the title dir.
 */
function getPartDirPath(sectionMetas: SectionMeta[], partNumber: string): string {
  // Get the relative file path of the first section in this part
  const first = sectionMetas.find((m) => m.partNumber === partNumber);
  if (!first) return `part-${partNumber}`;

  // Extract the directory portion of the relative file path
  const dir = dirname(first.relativeFile);
  return dir === "." ? `part-${partNumber}` : dir;
}

function buildReadme(
  titleNumber: string,
  titleName: string,
  parts: PartMeta[],
  sectionMetas: SectionMeta[],
  granularity: string,
): string {
  const totalTokens = Math.ceil(sectionMetas.reduce((sum, m) => sum + m.contentLength, 0) / 4);

  const lines: string[] = [];
  lines.push(`# Title ${titleNumber} — ${titleName}`);
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Source | eCFR (govinfo.gov) |`);
  lines.push(`| Legal Status | Authoritative, unofficial |`);
  lines.push(`| Parts | ${parts.length.toLocaleString()} |`);
  lines.push(`| Sections | ${sectionMetas.length.toLocaleString()} |`);
  lines.push(`| Estimated Tokens | ${totalTokens.toLocaleString()} |`);
  lines.push(`| Granularity | ${granularity} |`);
  lines.push("");
  lines.push("## Parts");
  lines.push("");

  for (const part of parts) {
    lines.push(`### Part ${part.number} — ${part.name} (${part.sections.length} sections)`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("Generated by LexBuild");
  lines.push("");

  return lines.join("\n");
}
