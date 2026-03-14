/**
 * eCFR frontmatter builder.
 *
 * Constructs FrontmatterData from an emitted eCFR AST node and its context.
 */

import type { LevelNode, EmitContext, FrontmatterData, ASTNode } from "@lexbuild/core";

/**
 * Build FrontmatterData from an eCFR section/part/title node.
 */
export function buildEcfrFrontmatter(node: LevelNode, context: EmitContext): FrontmatterData {
  const titleAncestor = context.ancestors.find((a) => a.levelType === "title");
  const partAncestor = context.ancestors.find((a) => a.levelType === "part");
  const chapterAncestor = context.ancestors.find((a) => a.levelType === "chapter");
  const subchapterAncestor = context.ancestors.find((a) => a.levelType === "subchapter");

  const titleNum = parseInt(titleAncestor?.numValue ?? node.numValue ?? "0", 10);
  const sectionNum = node.numValue ?? "0";
  const sectionName = node.heading?.trim() ?? "";
  const titleName = titleAncestor?.heading?.trim() ?? context.documentMeta.dcTitle ?? "";

  // Build display title based on level type
  let displayTitle: string;
  if (node.levelType === "title") {
    displayTitle = `Title ${titleNum} — ${titleName}`;
  } else if (node.levelType === "part") {
    displayTitle = `${titleNum} CFR Part ${sectionNum} - ${sectionName}`;
  } else {
    displayTitle = `${titleNum} CFR § ${sectionNum} - ${sectionName}`;
  }

  // Extract authority and source from note children
  const authority = extractNoteText(node, "authority");
  const regulatorySource = extractNoteText(node, "regulatorySource");

  // Also check part-level ancestors for authority/source
  // (AUTH and SOURCE appear at part level, not section level)
  const partAuthority = authority ?? extractNoteTextFromAncestors(context, "authority");
  const partSource = regulatorySource ?? extractNoteTextFromAncestors(context, "regulatorySource");

  // Extract source credit text (from SourceCreditNode children)
  const sourceCredit = extractSourceCreditText(node);

  const today = new Date().toISOString().slice(0, 10);

  const fm: FrontmatterData = {
    source: "ecfr",
    legal_status: "authoritative_unofficial",
    identifier: node.identifier ?? `/us/cfr/t${titleNum}/s${sectionNum}`,
    title: displayTitle,
    title_number: titleNum,
    title_name: titleName,
    positive_law: false, // Regulations, not legislation
    currency: today,
    last_updated: today,
  };

  if (node.levelType === "section" || node.levelType === "part") {
    fm.section_number = sectionNum;
    fm.section_name = sectionName;
  }

  if (chapterAncestor?.numValue) {
    // chapter_number is typed as number — only set for numeric chapters.
    // CFR chapters use Roman numerals (I, II, IV) which won't parse;
    // those are captured in chapter_name instead.
    const parsed = parseInt(chapterAncestor.numValue, 10);
    if (!isNaN(parsed)) {
      fm.chapter_number = parsed;
    }
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
    fm.cfr_part = partAncestor.numValue;
  } else if (node.levelType === "part") {
    fm.part_number = sectionNum;
    fm.cfr_part = sectionNum;
  }
  if (partAncestor?.heading) {
    fm.part_name = partAncestor.heading.trim();
  } else if (node.levelType === "part") {
    fm.part_name = sectionName;
  }

  if (partAuthority) {
    fm.authority = partAuthority;
  }
  if (partSource) {
    fm.regulatory_source = partSource;
  }
  if (sourceCredit) {
    fm.source_credit = sourceCredit;
  }
  if (node.status) {
    fm.status = node.status;
  }

  return fm;
}

/**
 * Extract text from a NoteNode child of the given type.
 */
function extractNoteText(node: LevelNode, noteType: string): string | undefined {
  for (const child of node.children) {
    if (child.type === "note" && (child as { noteType?: string }).noteType === noteType) {
      return flattenNoteText(child);
    }
  }
  return undefined;
}

/**
 * Try to find note text from part-level ancestor context.
 * This is a best-effort extraction since we only have ancestor info, not the full AST.
 */
function extractNoteTextFromAncestors(
  _context: EmitContext,
  _noteType: string,
): string | undefined {
  // Ancestor info doesn't include note children — this would require
  // the converter to pass enriched context. Return undefined for now;
  // authority/source will be populated from part-level notes during
  // the converter's write phase.
  return undefined;
}

/**
 * Extract source credit text from SourceCreditNode children.
 */
function extractSourceCreditText(node: LevelNode): string | undefined {
  for (const child of node.children) {
    if (child.type === "sourceCredit") {
      const parts: string[] = [];
      for (const inline of (child as { children: ASTNode[] }).children) {
        if (inline.type === "inline" && "text" in inline) {
          parts.push(inline.text as string);
        }
      }
      const text = parts.join("").trim();
      return text || undefined;
    }
  }
  return undefined;
}

/**
 * Flatten text content from a note node and its children.
 */
function flattenNoteText(node: ASTNode): string {
  const parts: string[] = [];

  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child.type === "content" && "children" in child) {
        for (const inline of (child as { children: ASTNode[] }).children) {
          if (inline.type === "inline" && "text" in inline && inline.text) {
            parts.push(inline.text as string);
          }
        }
      } else if (child.type === "inline" && "text" in child && child.text) {
        parts.push(child.text as string);
      } else {
        parts.push(flattenNoteText(child));
      }
    }
  }

  return parts.join("").trim();
}
