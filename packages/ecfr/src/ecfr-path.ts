/**
 * Output path builder for eCFR directory structure.
 *
 * eCFR path structure:
 *   output/ecfr/title-17/chapter-I/part-240/section-240.10b-5.md
 */

import { join } from "node:path";
import type { LevelNode, EmitContext } from "@lexbuild/core";

/**
 * Build the output file path for an eCFR section.
 */
export function buildEcfrOutputPath(
  node: LevelNode,
  context: EmitContext,
  outputRoot: string,
): string {
  const titleNum = findAncestorValue(context, "title") ?? node.numValue ?? "0";
  const chapterNum = findAncestorValue(context, "chapter");
  const partNum = findAncestorValue(context, "part");

  const titleDir = `title-${padTwo(titleNum)}`;
  const segments = [outputRoot, "ecfr", titleDir];

  if (chapterNum) {
    segments.push(`chapter-${chapterNum}`);
  }

  if (node.levelType === "title") {
    // Title-level file — flat file
    return join(outputRoot, "ecfr", `${titleDir}.md`);
  } else if (node.levelType === "chapter") {
    // Chapter-level file — directly inside title dir (no chapter subdirectory)
    const chapNum = node.numValue ?? "0";
    return join(outputRoot, "ecfr", titleDir, `chapter-${chapNum}.md`);
  } else if (node.levelType === "part") {
    // Part-level file — one file per part inside chapter dir
    segments.push(`part-${node.numValue ?? "0"}.md`);
  } else if (node.levelType === "appendix") {
    // Appendix — use sanitized name
    const appendixName = sanitizeFilename(node.numValue ?? node.heading ?? "appendix");
    if (partNum) {
      segments.push(`part-${partNum}`);
    }
    segments.push(`${appendixName}.md`);
  } else {
    // Section granularity
    if (partNum) {
      segments.push(`part-${partNum}`);
    }
    const sectionNum = node.numValue ?? "0";
    segments.push(`section-${sectionNum}.md`);
  }

  return join(...segments);
}

/**
 * Build the directory path for a title (used for _meta.json placement).
 */
export function buildTitleDir(titleNum: string, outputRoot: string): string {
  return join(outputRoot, "ecfr", `title-${padTwo(titleNum)}`);
}

function findAncestorValue(context: EmitContext, levelType: string): string | undefined {
  return context.ancestors.find((a) => a.levelType === levelType)?.numValue;
}

function padTwo(num: string): string {
  const n = parseInt(num, 10);
  return isNaN(n) ? num : String(n).padStart(2, "0");
}

function sanitizeFilename(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return sanitized || "appendix";
}
