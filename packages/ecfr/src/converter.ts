/**
 * eCFR conversion orchestrator.
 *
 * Follows the same collect-then-write pattern as the USC converter:
 * 1. Parse XML via SAX → feed EcfrASTBuilder
 * 2. Collect emitted sections/parts/titles
 * 3. Two-pass link registration (with duplicate detection)
 * 4. Write Markdown files, _meta.json, and README.md
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

/** Options for converting an eCFR XML file */
export interface EcfrConvertOptions {
  /** Path to input eCFR XML file */
  input: string;
  /** Output root directory */
  output: string;
  /** Output granularity: section (default), part, chapter, or title */
  granularity: "section" | "part" | "chapter" | "title";
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
}

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

/**
 * Convert an eCFR XML file to structured Markdown.
 */
export async function convertEcfrTitle(options: EcfrConvertOptions): Promise<EcfrConvertResult> {
  const { input, output, granularity, dryRun } = options;
  let peakMemory = process.memoryUsage().rss;

  // Map granularity to emit level.
  // Chapter and section granularity both emit at section level — chapter mode
  // groups sections by chapter ancestor in the write phase.
  const emitAt: LevelType =
    granularity === "title" ? "title" : granularity === "part" ? "part" : "section";

  // Collect phase
  const collected: CollectedSection[] = [];
  const builder = new EcfrASTBuilder({
    emitAt,
    onEmit: (node, context) => {
      collected.push({ node, context });
    },
  });

  // Parse XML — no namespace (eCFR XML has no namespace declarations)
  const parser = new XMLParser({ defaultNamespace: "" });
  parser.on("openElement", (name, attrs) => builder.onOpenElement(name, attrs));
  parser.on("closeElement", (name) => builder.onCloseElement(name));
  parser.on("text", (text) => builder.onText(text));

  const stream = createReadStream(input, "utf-8");
  await parser.parseStream(stream);

  // Track peak memory
  const rss = process.memoryUsage().rss;
  if (rss > peakMemory) peakMemory = rss;

  // Get part-level notes captured by the builder during parsing
  const partNotes = builder.getPartNotes();

  // Extract title info
  let titleNumber = "0";
  let titleName = "";
  const firstCollected = collected[0];
  if (firstCollected) {
    const firstCtx = firstCollected.context;
    const titleAncestor = firstCtx.ancestors.find((a) => a.levelType === "title");
    if (titleAncestor) {
      titleNumber = titleAncestor.numValue ?? "0";
      titleName = titleAncestor.heading ?? firstCtx.documentMeta.dcTitle ?? "";
    } else if (firstCollected.node.levelType === "title") {
      titleNumber = firstCollected.node.numValue ?? "0";
      titleName = firstCollected.node.heading ?? "";
    }
  }

  // Notes filter
  const notesFilter = buildNotesFilter(options);
  const renderOpts: RenderOptions = {
    headingOffset: 0,
    linkStyle: options.linkStyle,
    notesFilter,
  };

  if (dryRun) {
    return buildDryRunResult(collected, granularity, titleNumber, titleName, peakMemory);
  }

  // Two-pass link registration for section granularity
  const linkResolver = createLinkResolver();
  const sectionMetas: SectionMeta[] = [];

  if (granularity === "section") {
    // Pass 1: compute output paths, detect duplicates, and register all
    // identifiers with the link resolver BEFORE rendering. This ensures
    // both forward and backward cross-references can resolve.
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

      // Register canonical identifier for first occurrence only
      if (node.identifier && occurrence === 1) {
        linkResolver.register(node.identifier, suffixedPath);
      }
    }

    // Pass 2: render and write files (all identifiers are now registered)
    for (let i = 0; i < collected.length; i++) {
      const item = collected[i];
      const suffixedPath = outputPaths[i];
      if (!item || !suffixedPath) continue;
      const { node, context } = item;

      const frontmatter = buildEcfrFrontmatter(node, context);
      // Enrich with part-level authority/source from builder's captured notes
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
      await writeFile(suffixedPath, markdown, "utf-8");

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

      // Track peak memory
      const currentRss = process.memoryUsage().rss;
      if (currentRss > peakMemory) peakMemory = currentRss;
    }

    // Write _meta.json and README (dryRun returns early above, so this always runs)
    await writeMetaFiles(sectionMetas, titleNumber, titleName, output, granularity, input);

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
    };
  }

  // Chapter, part, or title granularity
  const files: string[] = [];
  let totalLength = 0;

  if (granularity === "chapter") {
    // Chapter granularity: group emitted sections by chapter ancestor,
    // then render each chapter as a composite document with all sections inlined.
    const chapterMap = new Map<
      string,
      { sections: CollectedSection[]; chapterAncestor: AncestorInfo; firstContext: EmitContext }
    >();

    for (const item of collected) {
      const chapterAnc = item.context.ancestors.find((a) => a.levelType === "chapter");
      const chapterKey = chapterAnc?.numValue ?? "__root__";
      const existing = chapterMap.get(chapterKey);
      if (existing) {
        existing.sections.push(item);
      } else {
        chapterMap.set(chapterKey, {
          sections: [item],
          chapterAncestor: chapterAnc ?? { levelType: "chapter", numValue: chapterKey },
          firstContext: item.context,
        });
      }
    }

    for (const [_chapterKey, { sections, chapterAncestor, firstContext }] of chapterMap) {
      // Build a synthetic chapter LevelNode containing all sections
      const chapterNode: LevelNode = {
        type: "level",
        levelType: "chapter",
        num: chapterAncestor.numValue,
        numValue: chapterAncestor.numValue,
        heading: chapterAncestor.heading,
        identifier: chapterAncestor.identifier,
        children: sections.map((s) => s.node),
      };

      const frontmatter = buildEcfrFrontmatter(chapterNode, firstContext);
      const markdown = renderDocument(chapterNode, frontmatter, renderOpts);

      const filePath = buildEcfrOutputPath(chapterNode, firstContext, output);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, markdown, "utf-8");
      files.push(filePath);
      totalLength += markdown.length;
    }
  } else {
    // Part or title granularity — filter to target level
    const targetLevel = emitAt;
    const filtered = collected.filter((c) => c.node.levelType === targetLevel);

    for (const { node, context } of filtered) {
      const frontmatter = buildEcfrFrontmatter(node, context);
      const markdown = renderDocument(node, frontmatter, renderOpts);

      const filePath = buildEcfrOutputPath(node, context, output);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, markdown, "utf-8");
      files.push(filePath);
      totalLength += markdown.length;
    }
  }

  // Compute partCount based on granularity
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
  };
}

function buildDryRunResult(
  collected: CollectedSection[],
  granularity: string,
  titleNumber: string,
  titleName: string,
  peakMemory: number,
): EcfrConvertResult {
  let totalEstimate = 0;
  let count: number;

  if (granularity === "chapter") {
    // Count unique chapter ancestors from section-level emissions
    const chapterKeys = new Set<string>();
    for (const { node, context } of collected) {
      const chapterAnc = context.ancestors.find((a) => a.levelType === "chapter");
      const key = chapterAnc?.numValue ?? "__root__";
      chapterKeys.add(key);
      totalEstimate += estimateTokens(node);
    }
    count = chapterKeys.size;
  } else {
    const targetLevel =
      granularity === "title" ? "title" : granularity === "part" ? "part" : "section";
    const filtered = collected.filter((c) => c.node.levelType === targetLevel);
    count = filtered.length;
    for (const { node } of filtered) {
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
  if (options.includeNotes) return undefined; // Include all

  // Check if any selective flag is set
  const hasSelective =
    options.includeEditorialNotes || options.includeStatutoryNotes || options.includeAmendments;

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
    currency: new Date().toISOString().slice(0, 10),
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
