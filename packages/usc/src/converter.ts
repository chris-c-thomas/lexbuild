/**
 * USC Converter — orchestrates the full conversion pipeline for a single USC XML file.
 *
 * Creates a ReadStream → SAX Parser → AST Builder (emit at section) →
 * Markdown Renderer + Frontmatter → File Writer.
 */

import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  XMLParser,
  ASTBuilder,
  renderDocument,
} from "@law2md/core";
import type {
  LevelNode,
  EmitContext,
  FrontmatterData,
  RenderOptions,
  AncestorInfo,
} from "@law2md/core";

/** Options for converting a USC XML file */
export interface ConvertOptions {
  /** Path to the input XML file */
  input: string;
  /** Output directory root */
  output: string;
  /** How to render cross-references */
  linkStyle: "relative" | "canonical" | "plaintext";
  /** Include source credits in output */
  includeSourceCredits: boolean;
}

/** Result of a conversion */
export interface ConvertResult {
  /** Number of sections written */
  sectionsWritten: number;
  /** Output paths of all written files */
  files: string[];
  /** Title number extracted from metadata */
  titleNumber: string;
  /** Title name extracted from metadata */
  titleName: string;
}

/** Default convert options */
const DEFAULTS: Omit<ConvertOptions, "input" | "output"> = {
  linkStyle: "plaintext",
  includeSourceCredits: true,
};

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

  // Collect sections during parsing (synchronous), write after parsing completes
  const sections: CollectedSection[] = [];

  // Set up the AST builder to emit at section level
  const builder = new ASTBuilder({
    emitAt: "section",
    onEmit: (node, context) => {
      sections.push({ node, context });
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

  // Write all collected sections to disk
  for (const { node, context } of sections) {
    const filePath = await writeSection(node, context, opts);
    if (filePath) {
      files.push(filePath);
    }
  }

  const meta = builder.getDocumentMeta();

  return {
    sectionsWritten: files.length,
    files,
    titleNumber: meta.docNumber ?? "unknown",
    titleName: meta.dcTitle ?? "Unknown Title",
  };
}

/**
 * Write a single section to disk.
 * Returns the output file path, or null if the section was skipped.
 */
async function writeSection(
  node: LevelNode,
  context: EmitContext,
  options: ConvertOptions,
): Promise<string | null> {
  const sectionNum = node.numValue;
  if (!sectionNum) return null;

  // Build the output file path
  const filePath = buildOutputPath(context, sectionNum, options.output);

  // Build frontmatter data
  const frontmatter = buildFrontmatter(node, context);

  // Build render options
  const renderOpts: RenderOptions = {
    headingOffset: 0,
    linkStyle: options.linkStyle,
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

  return filePath;
}

/**
 * Build the output file path for a section.
 *
 * Format: {output}/usc/title-{NN}/chapter-{NN}/section-{N}.md
 */
function buildOutputPath(
  context: EmitContext,
  sectionNum: string,
  outputRoot: string,
): string {
  const titleNum = findAncestor(context.ancestors, "title")?.numValue ?? "00";
  const chapterNum = findAncestor(context.ancestors, "chapter")?.numValue;

  const titleDir = `title-${padTwo(titleNum)}`;
  const sectionFile = `section-${sectionNum}.md`;

  if (chapterNum) {
    const chapterDir = `chapter-${padTwo(chapterNum)}`;
    return join(outputRoot, "usc", titleDir, chapterDir, sectionFile);
  }

  // No chapter — section directly under title (unusual but handle it)
  return join(outputRoot, "usc", titleDir, sectionFile);
}

/**
 * Build FrontmatterData from the emitted section node and context.
 */
function buildFrontmatter(node: LevelNode, context: EmitContext): FrontmatterData {
  const meta = context.documentMeta;
  const titleAncestor = findAncestor(context.ancestors, "title");
  const chapterAncestor = findAncestor(context.ancestors, "chapter");
  const subchapterAncestor = findAncestor(context.ancestors, "subchapter");
  const partAncestor = findAncestor(context.ancestors, "part");

  const titleNum = parseIntSafe(meta.docNumber ?? titleAncestor?.numValue ?? "0");
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
function findAncestor(ancestors: readonly AncestorInfo[], levelType: string): AncestorInfo | undefined {
  return ancestors.find((a) => a.levelType === levelType);
}

/**
 * Zero-pad a number string to 2 digits.
 */
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
