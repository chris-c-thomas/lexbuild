/**
 * USC Converter — orchestrates the full conversion pipeline for a single USC XML file.
 *
 * Creates a ReadStream → SAX Parser → AST Builder (emit at section) →
 * Markdown Renderer + Frontmatter → File Writer.
 */

import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { basename } from "node:path";
import {
  XMLParser,
  ASTBuilder,
  renderDocument,
  renderSection,
  generateFrontmatter,
  createLinkResolver,
  FORMAT_VERSION,
  GENERATOR,
} from "@law2md/core";
import type {
  LevelNode,
  EmitContext,
  FrontmatterData,
  RenderOptions,
  NotesFilter,
  AncestorInfo,
  LinkResolver,
} from "@law2md/core";

/** Options for converting a USC XML file */
export interface ConvertOptions {
  /** Path to the input XML file */
  input: string;
  /** Output directory root */
  output: string;
  /** Output granularity: "section" (one file per section) or "chapter" (sections inline) */
  granularity: "section" | "chapter";
  /** How to render cross-references */
  linkStyle: "relative" | "canonical" | "plaintext";
  /** Include source credits in output */
  includeSourceCredits: boolean;
  /** Include notes in output. True = all notes (default). False = no notes. */
  includeNotes: boolean;
  /** Include editorial notes only (when includeNotes is false) */
  includeEditorialNotes: boolean;
  /** Include statutory notes only (when includeNotes is false) */
  includeStatutoryNotes: boolean;
  /** Include amendment history notes only (when includeNotes is false) */
  includeAmendments: boolean;
  /** Dry-run mode: parse and report structure without writing files */
  dryRun: boolean;
}

/** Result of a conversion */
export interface ConvertResult {
  /** Number of sections written (or that would be written in dry-run) */
  sectionsWritten: number;
  /** Output paths of all written files (empty in dry-run) */
  files: string[];
  /** Title number extracted from metadata */
  titleNumber: string;
  /** Title name extracted from metadata */
  titleName: string;
  /** Whether this was a dry run */
  dryRun: boolean;
  /** Chapter count */
  chapterCount: number;
  /** Estimated total tokens */
  totalTokenEstimate: number;
  /** Peak resident set size in bytes during conversion */
  peakMemoryBytes: number;
}

/** Default convert options */
const DEFAULTS: Omit<ConvertOptions, "input" | "output"> = {
  granularity: "section",
  linkStyle: "plaintext",
  includeSourceCredits: true,
  includeNotes: true,
  includeEditorialNotes: false,
  includeStatutoryNotes: false,
  includeAmendments: false,
  dryRun: false,
};

/** Metadata collected for a written section (used to build _meta.json) */
interface SectionMeta {
  identifier: string;
  number: string;
  name: string;
  /** Filename only (e.g., "section-3598.md" or "section-3598-2.md" for duplicates) */
  fileName: string;
  /** File path relative to the title directory (e.g., "chapter-01/section-1.md") */
  relativeFile: string;
  /** Content length in characters (for token estimation) */
  contentLength: number;
  hasNotes: boolean;
  status: string;
  /** Chapter identifier this section belongs to */
  chapterIdentifier: string;
  chapterNumber: string;
  chapterName: string;
}

/** A collected section ready to be written */
interface CollectedSection {
  node: LevelNode;
  context: EmitContext;
}

/**
 * Convert a single USC XML file to section-level Markdown files.
 */
export async function convertTitle(options: ConvertOptions): Promise<ConvertResult> {
  const opts = { ...DEFAULTS, ...options };
  const files: string[] = [];
  let peakMemory = process.memoryUsage.rss();

  // Collect emitted nodes during parsing (synchronous), write after parsing completes
  const collected: CollectedSection[] = [];

  // Set up the AST builder — emit level depends on granularity
  const emitAt = opts.granularity === "chapter" ? "chapter" as const : "section" as const;
  const builder = new ASTBuilder({
    emitAt,
    onEmit: (node, context) => {
      collected.push({ node, context });
    },
  });

  // Set up the XML parser
  const parser = new XMLParser();
  parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
  parser.on("closeElement", (name) => builder.onCloseElement(name));
  parser.on("text", (text) => builder.onText(text));

  // Parse the XML file
  const stream = createReadStream(opts.input, "utf-8");
  await parser.parseStream(stream);
  peakMemory = Math.max(peakMemory, process.memoryUsage.rss());

  const sectionMetas: SectionMeta[] = [];
  const meta = builder.getDocumentMeta();

  if (opts.dryRun) {
    // Dry-run: collect metadata without writing files
    for (const { node, context } of collected) {
      if (opts.granularity === "chapter") {
        // Extract section metadata from chapter children
        for (const child of node.children) {
          if (child.type === "level" && child.levelType === "section") {
            sectionMetas.push(buildSectionMetaDryRun(child, node, context));
          }
        }
      } else {
        if (node.numValue) {
          sectionMetas.push(buildSectionMetaDryRun(node, null, context));
        }
      }
    }
  } else if (opts.granularity === "chapter") {
    // Chapter-level: each emitted node is a chapter containing sections
    for (const { node, context } of collected) {
      const result = await writeChapter(node, context, opts);
      if (result) {
        files.push(result.filePath);
        for (const m of result.sectionMetas) {
          sectionMetas.push(m);
        }
      }
    }
  } else {
    // Section-level with relative links: need two-pass for link resolver
    // Track duplicate section numbers per chapter to disambiguate filenames
    const sectionCounts = new Map<string, number>();
    const suffixes: (string | undefined)[] = [];
    for (const { node, context } of collected) {
      const sectionNum = node.numValue;
      if (!sectionNum) {
        suffixes.push(undefined);
        continue;
      }
      const chapterDir = buildChapterDir(context) ?? "__root__";
      const key = `${chapterDir}/${sectionNum}`;
      const count = (sectionCounts.get(key) ?? 0) + 1;
      sectionCounts.set(key, count);
      suffixes.push(count > 1 ? `-${count}` : undefined);
    }

    const linkResolver = createLinkResolver();
    for (const [i, { node, context }] of collected.entries()) {
      const sectionNum = node.numValue;
      if (sectionNum && node.identifier) {
        const filePath = buildOutputPath(context, sectionNum, opts.output, suffixes[i]);
        // For duplicates, register with the XML element @id to disambiguate
        const regId = suffixes[i] ? `${node.identifier}#${suffixes[i]}` : node.identifier;
        linkResolver.register(regId, filePath);
        // Always register the first occurrence under the canonical identifier
        if (!suffixes[i]) {
          linkResolver.register(node.identifier, filePath);
        }
      }
    }

    for (const [i, { node, context }] of collected.entries()) {
      const result = await writeSection(node, context, opts, linkResolver, suffixes[i]);
      if (result) {
        files.push(result.filePath);
        sectionMetas.push(result.meta);
      }
    }
  }

  // Extract the title heading from the first collected section's ancestors
  const firstCollected = collected[0];
  const titleHeading = firstCollected
    ? findAncestor(firstCollected.context.ancestors, "title")?.heading?.trim()
    : undefined;

  // Generate _meta.json and README.md files (skip in dry-run)
  if (!opts.dryRun) {
    await writeMetaFiles(sectionMetas, meta, opts, titleHeading);
  }

  // Final memory sample
  peakMemory = Math.max(peakMemory, process.memoryUsage.rss());

  // Compute stats
  const chapterIds = new Set(sectionMetas.map((s) => s.chapterIdentifier));
  const totalTokens = sectionMetas.reduce((sum, s) => sum + Math.ceil(s.contentLength / 4), 0);

  return {
    sectionsWritten: opts.dryRun ? sectionMetas.length : files.length,
    files,
    titleNumber: meta.docNumber ?? "unknown",
    titleName: meta.dcTitle ?? "Unknown Title",
    dryRun: opts.dryRun,
    chapterCount: chapterIds.size,
    totalTokenEstimate: totalTokens,
    peakMemoryBytes: peakMemory,
  };
}

/** Result of writing a single section */
interface WriteSectionResult {
  filePath: string;
  meta: SectionMeta;
}

/**
 * Write a single section to disk.
 * Returns the file path and metadata, or null if the section was skipped.
 */
async function writeSection(
  node: LevelNode,
  context: EmitContext,
  options: ConvertOptions,
  linkResolver?: LinkResolver | undefined,
  /** Disambiguation suffix for duplicate section numbers (e.g., "-2") */
  dupSuffix?: string | undefined,
): Promise<WriteSectionResult | null> {
  const sectionNum = node.numValue;
  if (!sectionNum) return null;

  // Build the output file path (with optional duplicate suffix)
  const filePath = buildOutputPath(context, sectionNum, options.output, dupSuffix);

  // Build frontmatter data
  const frontmatter = buildFrontmatter(node, context);

  // Build notes filter
  const notesFilter = buildNotesFilter(options);

  // Build render options with link resolver for relative links
  const renderOpts: RenderOptions = {
    headingOffset: 0,
    linkStyle: options.linkStyle,
    resolveLink: linkResolver
      ? (identifier: string) => linkResolver.resolve(identifier, filePath)
      : undefined,
    notesFilter,
  };

  // Optionally strip source credits
  const sectionNode = options.includeSourceCredits
    ? node
    : stripSourceCredits(node);

  // Render the document
  const markdown = renderDocument(sectionNode, frontmatter, renderOpts);

  // Ensure the directory exists and write the file
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, markdown, "utf-8");

  // Collect metadata
  const titleNum = findAncestor(context.ancestors, "title")?.numValue ?? "0";
  const chapterAncestor = findAncestor(context.ancestors, "chapter");
  const chapterDir = chapterAncestor?.numValue ? `chapter-${padTwo(chapterAncestor.numValue)}` : "";
  const sectionFileName = `section-${sectionNum}${dupSuffix ?? ""}.md`;
  const relativeFile = chapterDir
    ? `${chapterDir}/${sectionFileName}`
    : sectionFileName;

  const hasNotes = node.children.some(
    (c) => c.type === "notesContainer" || c.type === "note",
  );

  const sectionMeta: SectionMeta = {
    identifier: node.identifier ?? `/us/usc/t${titleNum}/s${sectionNum}`,
    number: sectionNum,
    name: node.heading?.trim() ?? "",
    fileName: sectionFileName,
    relativeFile,
    contentLength: markdown.length,
    hasNotes,
    status: node.status ?? "current",
    chapterIdentifier: chapterAncestor?.identifier ?? "",
    chapterNumber: chapterAncestor?.numValue ?? "0",
    chapterName: chapterAncestor?.heading?.trim() ?? "",
  };

  return { filePath, meta: sectionMeta };
}

/**
 * Build the output file path for a section.
 *
 * Format: {output}/usc/title-{NN}/chapter-{NN}/section-{N}.md
 */
/**
 * Generate _meta.json files at title and chapter levels.
 */
async function writeMetaFiles(
  sectionMetas: SectionMeta[],
  docMeta: { dcTitle?: string | undefined; docNumber?: string | undefined; positivelaw?: boolean | undefined; docPublicationName?: string | undefined; created?: string | undefined; identifier?: string | undefined },
  options: ConvertOptions,
  titleHeading?: string | undefined,
): Promise<void> {
  if (sectionMetas.length === 0) return;

  const docNum = docMeta.docNumber ?? "0";
  const titleDirName = buildTitleDirFromDocNumber(docNum);
  const titleDir = join(options.output, "usc", titleDirName);
  const currency = parseCurrency(docMeta.docPublicationName ?? "");

  // Group sections by chapter
  const chapterMap = new Map<string, SectionMeta[]>();
  for (const sm of sectionMetas) {
    const key = sm.chapterIdentifier || "__no_chapter__";
    let arr = chapterMap.get(key);
    if (!arr) {
      arr = [];
      chapterMap.set(key, arr);
    }
    arr.push(sm);
  }

  // Write chapter-level _meta.json files
  const chapterEntries: Array<{
    identifier: string;
    number: number;
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
  }> = [];

  for (const [chapterId, chapterSections] of chapterMap) {
    if (chapterId === "__no_chapter__") continue;

    const first = chapterSections[0];
    if (!first) continue;

    const chapterDir = `chapter-${padTwo(first.chapterNumber)}`;

    const sections = chapterSections.map((sm) => ({
      identifier: sm.identifier,
      number: sm.number,
      name: sm.name,
      file: sm.fileName,
      token_estimate: Math.ceil(sm.contentLength / 4),
      has_notes: sm.hasNotes,
      status: sm.status,
    }));

    const chapterMeta = {
      format_version: FORMAT_VERSION,
      identifier: chapterId,
      chapter_number: parseIntSafe(first.chapterNumber),
      chapter_name: first.chapterName,
      title_number: parseIntSafe(docNum),
      section_count: sections.length,
      sections,
    };

    const chapterMetaPath = join(titleDir, chapterDir, "_meta.json");
    await mkdir(dirname(chapterMetaPath), { recursive: true });
    await writeFile(chapterMetaPath, JSON.stringify(chapterMeta, null, 2) + "\n", "utf-8");

    chapterEntries.push({
      identifier: chapterId,
      number: parseIntSafe(first.chapterNumber),
      name: first.chapterName,
      directory: chapterDir,
      sections,
    });
  }

  // Write title-level _meta.json
  const totalTokens = sectionMetas.reduce((sum, sm) => sum + Math.ceil(sm.contentLength / 4), 0);

  const titleMeta = {
    format_version: FORMAT_VERSION,
    generator: GENERATOR,
    generated_at: new Date().toISOString(),
    identifier: docMeta.identifier ?? `/us/usc/t${docNum}`,
    title_number: parseIntSafe(docNum),
    title_name: titleHeading ?? docMeta.dcTitle ?? "",
    positive_law: docMeta.positivelaw ?? false,
    currency,
    source_xml: basename(options.input),
    granularity: options.granularity,
    stats: {
      chapter_count: chapterEntries.length,
      section_count: sectionMetas.length,
      total_files: sectionMetas.length,
      total_tokens_estimate: totalTokens,
    },
    chapters: chapterEntries,
  };

  const titleMetaPath = join(titleDir, "_meta.json");
  await mkdir(dirname(titleMetaPath), { recursive: true });
  await writeFile(titleMetaPath, JSON.stringify(titleMeta, null, 2) + "\n", "utf-8");

  // Write title-level README.md
  const readmePath = join(titleDir, "README.md");
  const readme = generateTitleReadme(titleMeta);
  await writeFile(readmePath, readme, "utf-8");
}

/**
 * Generate a human-readable README.md for a title output directory.
 */
function generateTitleReadme(meta: {
  title_number: number;
  title_name: string;
  positive_law: boolean;
  currency: string;
  granularity: string;
  stats: {
    chapter_count: number;
    section_count: number;
    total_tokens_estimate: number;
  };
  chapters: Array<{
    number: number;
    name: string;
    directory: string;
    sections: Array<{
      number: string;
      name: string;
      file: string;
      status: string;
    }>;
  }>;
}): string {
  const lines: string[] = [];

  lines.push(`# Title ${meta.title_number} — ${meta.title_name}`);
  lines.push("");
  lines.push(`| | |`);
  lines.push(`| --- | --- |`);
  lines.push(`| **Positive Law** | ${meta.positive_law ? "Yes" : "No"} |`);
  lines.push(`| **Currency** | ${meta.currency || "unknown"} |`);
  lines.push(`| **Chapters** | ${meta.stats.chapter_count} |`);
  lines.push(`| **Sections** | ${meta.stats.section_count.toLocaleString()} |`);
  lines.push(`| **Est. Tokens** | ${meta.stats.total_tokens_estimate.toLocaleString()} |`);
  lines.push(`| **Granularity** | ${meta.granularity} |`);
  lines.push("");

  // Chapter listing
  lines.push("## Chapters");
  lines.push("");

  for (const ch of meta.chapters) {
    const sectionCount = ch.sections.length;
    lines.push(`### Chapter ${ch.number} — ${ch.name}`);
    lines.push("");
    lines.push(`${sectionCount} section${sectionCount !== 1 ? "s" : ""} · [${ch.directory}/](${ch.directory}/)`);
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`Generated by [law2md](https://github.com/chris-c-thomas/law2md)`);
  lines.push("");

  return lines.join("\n");
}

/** Result of writing a chapter file */
interface WriteChapterResult {
  filePath: string;
  sectionMetas: SectionMeta[];
}

/**
 * Write a chapter-level file (all sections inlined).
 * The emitted node is a chapter LevelNode whose children include section LevelNodes.
 */
async function writeChapter(
  chapterNode: LevelNode,
  context: EmitContext,
  options: ConvertOptions,
): Promise<WriteChapterResult | null> {
  const chapterNum = chapterNode.numValue;
  if (!chapterNum) return null;

  const titleNum = findAncestor(context.ancestors, "title")?.numValue ?? "0";
  const titleDir = `title-${padTwo(titleNum)}`;
  const chapterFile = `chapter-${padTwo(chapterNum)}.md`;
  const filePath = join(options.output, "usc", titleDir, chapterFile);

  // Build chapter-level frontmatter
  const titleAncestor = findAncestor(context.ancestors, "title");
  const meta = context.documentMeta;
  const chapterName = chapterNode.heading?.trim() ?? "";
  const titleName = titleAncestor?.heading?.trim() ?? meta.dcTitle ?? "";
  const currency = parseCurrency(meta.docPublicationName ?? "");
  const lastUpdated = parseDate(meta.created ?? "");

  const fmData: FrontmatterData = {
    identifier: chapterNode.identifier ?? `/us/usc/t${titleNum}/ch${chapterNum}`,
    title: `${titleNum} USC Chapter ${chapterNum} - ${chapterName}`,
    title_number: parseIntSafe(titleNum),
    title_name: titleName,
    section_number: chapterNum,
    section_name: chapterName,
    chapter_number: parseIntSafe(chapterNum),
    chapter_name: chapterName,
    positive_law: meta.positivelaw ?? false,
    currency,
    last_updated: lastUpdated,
  };

  const notesFilter = buildNotesFilter(options);
  const renderOpts: RenderOptions = {
    headingOffset: 0,
    linkStyle: options.linkStyle,
    notesFilter,
  };

  // Build the chapter Markdown: heading + each section rendered with H2
  const parts: string[] = [];
  parts.push(generateFrontmatter(fmData));
  parts.push("");
  parts.push(`# Chapter ${chapterNum} — ${chapterName}`);

  // Collect section metas and render each section
  const sectionMetas: SectionMeta[] = [];

  for (const child of chapterNode.children) {
    if (child.type === "level" && child.levelType === "section") {
      const sectionOpts: RenderOptions = { ...renderOpts, headingOffset: 1 };
      const sectionNode = options.includeSourceCredits ? child : stripSourceCredits(child);
      const sectionMd = renderSection(sectionNode, sectionOpts);
      parts.push("");
      parts.push(sectionMd);

      // Collect section metadata
      const sectionNum = child.numValue ?? "0";
      const hasNotes = child.children.some(
        (c) => c.type === "notesContainer" || c.type === "note",
      );
      sectionMetas.push({
        identifier: child.identifier ?? `/us/usc/t${titleNum}/s${sectionNum}`,
        number: sectionNum,
        name: child.heading?.trim() ?? "",
        fileName: `section-${sectionNum}.md`,
        relativeFile: chapterFile,
        contentLength: sectionMd.length,
        hasNotes,
        status: child.status ?? "current",
        chapterIdentifier: chapterNode.identifier ?? "",
        chapterNumber: chapterNum,
        chapterName,
      });
    }
  }

  const markdown = parts.join("\n") + "\n";

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, markdown, "utf-8");

  return { filePath, sectionMetas };
}

function buildOutputPath(
  context: EmitContext,
  sectionNum: string,
  outputRoot: string,
  /** Disambiguation suffix for duplicate section numbers (e.g., "-2") */
  dupSuffix?: string | undefined,
): string {
  const titleDir = buildTitleDir(context);
  const chapterDir = buildChapterDir(context);
  const sectionFile = `section-${sectionNum}${dupSuffix ?? ""}.md`;

  if (chapterDir) {
    return join(outputRoot, "usc", titleDir, chapterDir, sectionFile);
  }

  return join(outputRoot, "usc", titleDir, sectionFile);
}

/**
 * Build the title directory name from context.
 * Handles appendix titles: docNumber "5a" → "title-05-appendix"
 */
function buildTitleDir(context: EmitContext): string {
  // Check for appendix via docNumber (e.g., "5a", "11a")
  const docNum = context.documentMeta.docNumber ?? "";
  const appendixMatch = /^(\d+)a$/i.exec(docNum);
  if (appendixMatch?.[1]) {
    return `title-${padTwo(appendixMatch[1])}-appendix`;
  }

  // Check for appendix ancestor
  const appendixAncestor = findAncestor(context.ancestors, "appendix");
  if (appendixAncestor) {
    const num = appendixAncestor.numValue ?? docNum;
    const numericPart = /^(\d+)/.exec(num);
    if (numericPart?.[1]) {
      return `title-${padTwo(numericPart[1])}-appendix`;
    }
  }

  // Normal title
  const titleNum = findAncestor(context.ancestors, "title")?.numValue ?? "00";
  return `title-${padTwo(titleNum)}`;
}

/**
 * Build the chapter directory name from context.
 * Handles chapter equivalents: compiledAct, reorganizationPlan.
 */
function buildChapterDir(context: EmitContext): string | undefined {
  // Standard chapter
  const chapterNum = findAncestor(context.ancestors, "chapter")?.numValue;
  if (chapterNum) return `chapter-${padTwo(chapterNum)}`;

  // Compiled act as chapter equivalent
  const compiledAct = findAncestor(context.ancestors, "compiledAct");
  if (compiledAct) {
    const heading = compiledAct.heading?.trim() ?? "";
    // Use a slug of the heading as directory name
    const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    return slug || "compiled-act";
  }

  // Reorganization plan as chapter equivalent
  const reorgPlan = findAncestor(context.ancestors, "reorganizationPlan");
  if (reorgPlan) {
    const heading = reorgPlan.heading?.trim() ?? "";
    const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    return slug || "reorganization-plan";
  }

  // Reorganization plans container
  const reorgPlans = findAncestor(context.ancestors, "reorganizationPlans");
  if (reorgPlans) {
    return "reorganization-plans";
  }

  return undefined;
}

/**
 * Build FrontmatterData from the emitted section node and context.
 */
function buildFrontmatter(node: LevelNode, context: EmitContext): FrontmatterData {
  const meta = context.documentMeta;
  const titleAncestor = findAncestor(context.ancestors, "title") ?? findAncestor(context.ancestors, "appendix");
  const chapterAncestor = findAncestor(context.ancestors, "chapter")
    ?? findAncestor(context.ancestors, "compiledAct")
    ?? findAncestor(context.ancestors, "reorganizationPlan");
  const subchapterAncestor = findAncestor(context.ancestors, "subchapter");
  const partAncestor = findAncestor(context.ancestors, "part");

  const docNum = meta.docNumber ?? titleAncestor?.numValue ?? "0";
  const titleNum = parseIntSafe(docNum.replace(/a$/i, ""));
  const sectionNum = node.numValue ?? "0";
  const sectionName = node.heading?.trim() ?? "";
  const titleName = titleAncestor?.heading?.trim() ?? meta.dcTitle ?? "";

  // Build the human-readable title: "1 USC § 1 - Section Name"
  const displayTitle = `${titleNum} USC § ${sectionNum} - ${sectionName}`;

  // Extract source credit text from the section's children
  const sourceCredit = extractSourceCreditText(node);

  // Parse currency from docPublicationName (e.g., "Online@119-73not60" → "119-73")
  const currency = parseCurrency(meta.docPublicationName ?? "");

  // Parse last_updated from created timestamp
  const lastUpdated = parseDate(meta.created ?? "");

  const fm: FrontmatterData = {
    identifier: node.identifier ?? `/us/usc/t${titleNum}/s${sectionNum}`,
    title: displayTitle,
    title_number: titleNum,
    title_name: titleName,
    section_number: sectionNum,
    section_name: sectionName,
    positive_law: meta.positivelaw ?? false,
    currency,
    last_updated: lastUpdated,
  };

  if (chapterAncestor?.numValue) {
    fm.chapter_number = parseIntSafe(chapterAncestor.numValue);
  }
  if (chapterAncestor?.heading) {
    fm.chapter_name = chapterAncestor.heading.trim();
  }
  if (subchapterAncestor?.numValue) {
    fm.subchapter_number = subchapterAncestor.numValue;
  }
  if (subchapterAncestor?.heading) {
    fm.subchapter_name = subchapterAncestor.heading.trim();
  }
  if (partAncestor?.numValue) {
    fm.part_number = partAncestor.numValue;
  }
  if (partAncestor?.heading) {
    fm.part_name = partAncestor.heading.trim();
  }
  if (sourceCredit) {
    fm.source_credit = sourceCredit;
  }
  if (node.status) {
    fm.status = node.status;
  }

  return fm;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Find an ancestor by level type.
 */
/**
 * Build a NotesFilter from convert options.
 * Returns undefined if all notes should be included (default).
 */
/**
 * Build SectionMeta from AST node without rendering (for dry-run mode).
 */
function buildSectionMetaDryRun(
  sectionNode: LevelNode,
  chapterNode: LevelNode | null,
  context: EmitContext,
): SectionMeta {
  const titleNum = findAncestor(context.ancestors, "title")?.numValue ?? "0";
  const chapterAncestor = chapterNode
    ? { numValue: chapterNode.numValue, heading: chapterNode.heading, identifier: chapterNode.identifier }
    : findAncestor(context.ancestors, "chapter");
  const sectionNum = sectionNode.numValue ?? "0";
  const chapterNum = chapterAncestor?.numValue ?? "0";
  const chapterDir = chapterNum !== "0" ? `chapter-${padTwo(chapterNum)}` : "";

  const hasNotes = sectionNode.children.some(
    (c) => c.type === "notesContainer" || c.type === "note",
  );

  // Rough content length estimate from AST text nodes
  let contentLength = 0;
  const walk = (node: { children?: readonly { text?: string | undefined; children?: readonly unknown[] }[] | undefined; text?: string | undefined }): void => {
    if (node.text) contentLength += node.text.length;
    if (node.children) {
      for (const child of node.children) {
        walk(child as typeof node);
      }
    }
  };
  walk(sectionNode as unknown as Parameters<typeof walk>[0]);

  const sectionFileName = `section-${sectionNum}.md`;
  return {
    identifier: sectionNode.identifier ?? `/us/usc/t${titleNum}/s${sectionNum}`,
    number: sectionNum,
    name: sectionNode.heading?.trim() ?? "",
    fileName: sectionFileName,
    relativeFile: chapterDir ? `${chapterDir}/${sectionFileName}` : sectionFileName,
    contentLength,
    hasNotes,
    status: sectionNode.status ?? "current",
    chapterIdentifier: chapterAncestor?.identifier ?? "",
    chapterNumber: chapterNum,
    chapterName: chapterAncestor?.heading?.trim() ?? "",
  };
}

function buildNotesFilter(options: ConvertOptions): NotesFilter | undefined {
  // Default: include all notes
  if (options.includeNotes) return undefined;

  // No notes at all
  if (!options.includeEditorialNotes && !options.includeStatutoryNotes && !options.includeAmendments) {
    return { editorial: false, statutory: false, amendments: false };
  }

  // Selective inclusion
  return {
    editorial: options.includeEditorialNotes,
    statutory: options.includeStatutoryNotes,
    amendments: options.includeAmendments,
  };
}

function findAncestor(ancestors: readonly AncestorInfo[], levelType: string): AncestorInfo | undefined {
  return ancestors.find((a) => a.levelType === levelType);
}

/**
 * Zero-pad a number string to 2 digits.
 */
/**
 * Build title directory name from docNumber.
 * "5" → "title-05", "5a" → "title-05-appendix"
 */
function buildTitleDirFromDocNumber(docNum: string): string {
  const appendixMatch = /^(\d+)a$/i.exec(docNum);
  if (appendixMatch?.[1]) {
    return `title-${padTwo(appendixMatch[1])}-appendix`;
  }
  return `title-${padTwo(docNum)}`;
}

function padTwo(num: string): string {
  const n = parseInt(num, 10);
  if (isNaN(n)) return num;
  return n.toString().padStart(2, "0");
}

/**
 * Parse an integer safely, returning 0 if invalid.
 */
function parseIntSafe(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Extract source credit plain text from a section node's children.
 */
function extractSourceCreditText(node: LevelNode): string | undefined {
  for (const child of node.children) {
    if (child.type === "sourceCredit") {
      return child.children
        .map((inline) => inlineToText(inline))
        .join("");
    }
  }
  return undefined;
}

/**
 * Recursively extract plain text from an InlineNode.
 */
function inlineToText(node: { readonly type: "inline"; text?: string | undefined; children?: readonly { readonly type: "inline"; text?: string | undefined }[] | undefined }): string {
  if (node.text) return node.text;
  if (node.children) {
    return node.children.map((c) => c.text ?? "").join("");
  }
  return "";
}

/**
 * Parse currency/release point from docPublicationName.
 * Example: "Online@119-73not60" → "119-73"
 */
function parseCurrency(pubName: string): string {
  // Try to extract the release point pattern (e.g., "119-73")
  const match = /(\d+-\d+)/.exec(pubName);
  if (match?.[1]) return match[1];
  return pubName || "unknown";
}

/**
 * Parse a date string to ISO date format (YYYY-MM-DD).
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return "unknown";
  // Handle ISO timestamp: "2025-12-03T10:11:39" → "2025-12-03"
  const datePart = dateStr.split("T")[0];
  return datePart ?? dateStr;
}

/**
 * Create a copy of a section node with source credit children removed.
 */
function stripSourceCredits(node: LevelNode): LevelNode {
  return {
    ...node,
    children: node.children.filter((c) => c.type !== "sourceCredit"),
  };
}
