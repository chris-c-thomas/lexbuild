/**
 * Markdown renderer — converts AST nodes to Markdown strings.
 *
 * Stateless and pure: no side effects, no file I/O.
 */

import type {
  ASTNode,
  LevelNode,
  ContentNode,
  InlineNode,
  NoteNode,
  SourceCreditNode,
  TableNode,
  NotesContainerNode,
  QuotedContentNode,
  FrontmatterData,
} from "../ast/types.js";
import { SMALL_LEVELS } from "../ast/types.js";
import { generateFrontmatter } from "./frontmatter.js";

/** Notes filtering configuration */
export interface NotesFilter {
  /** Include editorial notes (codification, dispositionOfSections, etc.) */
  editorial: boolean;
  /** Include statutory notes (changeOfName, regulations, miscellaneous, repeals, etc.) */
  statutory: boolean;
  /** Include amendment history (amendments, effectiveDateOfAmendment) */
  amendments: boolean;
}

/** Options for controlling Markdown rendering */
export interface RenderOptions {
  /** Heading level offset (0 = section is H1, 1 = section is H2) */
  headingOffset: number;
  /** How to render cross-references */
  linkStyle: "relative" | "canonical" | "plaintext";
  /** Function to resolve a USLM identifier to a relative file path (for linkStyle "relative") */
  resolveLink?: ((identifier: string) => string | null) | undefined;
  /** Notes filtering. Undefined = include all notes. */
  notesFilter?: NotesFilter | undefined;
}

/** Default render options */
export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  headingOffset: 0,
  linkStyle: "plaintext",
};

/**
 * Render a complete section document: frontmatter + Markdown content.
 */
export function renderDocument(
  sectionNode: LevelNode,
  frontmatter: FrontmatterData,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
): string {
  const fm = generateFrontmatter(frontmatter);
  const content = renderSection(sectionNode, options);
  return `${fm}\n\n${content}\n`;
}

/**
 * Render a section-level node to Markdown.
 */
export function renderSection(node: LevelNode, options: RenderOptions = DEFAULT_RENDER_OPTIONS): string {
  const parts: string[] = [];

  // Section heading: # § {number}. {heading}
  const headingLevel = 1 + options.headingOffset;
  const prefix = "#".repeat(headingLevel);
  const numDisplay = node.num ?? "";
  const heading = node.heading ? ` ${node.heading}` : "";
  parts.push(`${prefix} ${numDisplay}${heading}`);

  // Render children
  for (const child of node.children) {
    const rendered = renderNode(child, options);
    if (rendered) {
      parts.push(rendered);
    }
  }

  return parts.join("\n\n");
}

/**
 * Render any AST node to Markdown.
 */
export function renderNode(node: ASTNode, options: RenderOptions = DEFAULT_RENDER_OPTIONS): string {
  switch (node.type) {
    case "level":
      return renderLevel(node, options);
    case "content":
      return renderContent(node);
    case "inline":
      return renderInline(node, options);
    case "sourceCredit":
      return renderSourceCredit(node, options);
    case "note":
      return renderNote(node, options);
    case "notesContainer":
      return renderNotesContainer(node, options);
    case "quotedContent":
      return renderQuotedContent(node, options);
    case "table":
      return renderTable(node);
    case "toc":
    case "tocItem":
      return "";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Level rendering (subsection, paragraph, etc.)
// ---------------------------------------------------------------------------

/**
 * Render a sub-section level (subsection, paragraph, clause, etc.)
 * These use bold inline numbering, NOT Markdown headings.
 */
function renderLevel(node: LevelNode, options: RenderOptions): string {
  // Small levels use bold inline numbering
  if (SMALL_LEVELS.has(node.levelType)) {
    return renderSmallLevel(node, options);
  }

  // Big levels within a section (unusual, but handle gracefully)
  const parts: string[] = [];
  if (node.num ?? node.heading) {
    const numDisplay = node.num ?? "";
    const heading = node.heading ? ` ${node.heading}` : "";
    parts.push(`**${numDisplay}${heading}**`);
  }
  for (const child of node.children) {
    const rendered = renderNode(child, options);
    if (rendered) {
      parts.push(rendered);
    }
  }
  return parts.join("\n\n");
}

/**
 * Render a small level (subsection through subsubitem) with bold inline numbering.
 *
 * Format: **(a)** **Heading.** — Content text...
 * Or just: **(a)** Content text...
 */
function renderSmallLevel(node: LevelNode, options: RenderOptions): string {
  const parts: string[] = [];

  // Build the prefix: **(a)** or **(1)** etc.
  const numDisplay = node.num ?? (node.numValue ? `(${node.numValue})` : "");
  let prefix = numDisplay ? `**${numDisplay}**` : "";

  // If there's a heading, add it after the num
  if (node.heading) {
    prefix += ` **${node.heading}**`;
  }

  // Collect content and child levels
  const contentParts: string[] = [];
  const childParts: string[] = [];

  for (const child of node.children) {
    if (child.type === "content") {
      contentParts.push(renderContent(child));
    } else if (child.type === "level") {
      childParts.push(renderNode(child, options));
    } else {
      const rendered = renderNode(child, options);
      if (rendered) {
        childParts.push(rendered);
      }
    }
  }

  // Combine prefix with first content block on the same line
  if (contentParts.length > 0) {
    const firstContent = contentParts[0] ?? "";
    if (prefix) {
      parts.push(`${prefix} ${firstContent}`);
    } else {
      parts.push(firstContent);
    }
    // Additional content blocks as separate paragraphs
    for (let i = 1; i < contentParts.length; i++) {
      parts.push(contentParts[i] ?? "");
    }
  } else if (prefix) {
    parts.push(prefix);
  }

  // Child levels as separate paragraphs
  for (const child of childParts) {
    parts.push(child);
  }

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Content rendering
// ---------------------------------------------------------------------------

/**
 * Render a content block (content, chapeau, continuation, proviso).
 * Normalizes whitespace: collapses runs of whitespace between paragraphs
 * into clean double-newline paragraph breaks, and trims edges.
 */
function renderContent(node: ContentNode): string {
  const raw = renderInlineChildren(node.children);
  return normalizeWhitespace(raw);
}

/**
 * Render a list of inline nodes to a string.
 */
function renderInlineChildren(children: InlineNode[], options?: RenderOptions): string {
  return children.map((child) => renderInline(child, options)).join("");
}

/**
 * Normalize whitespace in rendered text:
 * - Trim leading/trailing whitespace
 * - Collapse 2+ consecutive newlines (with optional spaces) into double-newline
 */
function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\n\s*\n/g, "\n\n");
}

// ---------------------------------------------------------------------------
// Inline rendering
// ---------------------------------------------------------------------------

/**
 * Render an inline node to a Markdown string.
 */
function renderInline(node: InlineNode, options?: RenderOptions): string {
  switch (node.inlineType) {
    case "text":
      return node.text ?? renderInlineChildren(node.children ?? [], options);

    case "bold":
      return `**${getInlineText(node, options)}**`;

    case "italic":
      return `*${getInlineText(node, options)}*`;

    case "ref":
      return renderRef(node, options);

    case "date":
      return getInlineText(node, options);

    case "term":
      return `**${getInlineText(node, options)}**`;

    case "quoted":
      return `"${node.text ?? getInlineText(node, options)}"`;

    case "sup":
      return `<sup>${getInlineText(node, options)}</sup>`;

    case "sub":
      return `<sub>${getInlineText(node, options)}</sub>`;

    case "footnoteRef":
      return `[^${getInlineText(node, options)}]`;

    default:
      return getInlineText(node, options);
  }
}

/**
 * Get the text content of an inline node (recursing into children if needed).
 */
function getInlineText(node: InlineNode, options?: RenderOptions): string {
  if (node.text) return node.text;
  if (node.children) return renderInlineChildren(node.children, options);
  return "";
}

/**
 * Render a cross-reference link.
 */
function renderRef(node: InlineNode, options?: RenderOptions): string {
  const text = getInlineText(node, options);
  const href = node.href;

  if (!href) {
    return text;
  }

  const style = options?.linkStyle ?? "plaintext";

  if (style === "plaintext") {
    return text;
  }

  if (style === "relative" && options?.resolveLink) {
    const resolved = options.resolveLink(href);
    if (resolved) {
      return `[${text}](${resolved})`;
    }
  }

  // For USC references, generate OLRC fallback URL
  if (href.startsWith("/us/usc/")) {
    const olrcUrl = buildOlrcUrl(href);
    return `[${text}](${olrcUrl})`;
  }

  // Non-USC references (stat, pl, act) — just render as text
  return text;
}

/**
 * Build an OLRC website URL from a USLM identifier.
 */
function buildOlrcUrl(identifier: string): string {
  // /us/usc/t{N}/s{N} → granuleid:USC-prelim-title{N}-section{N}
  const match = /^\/us\/usc\/t(\d+)(?:\/s(.+?))?(?:\/|$)/.exec(identifier);
  if (match) {
    const titleNum = match[1];
    const sectionNum = match[2];
    if (sectionNum) {
      return `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${titleNum}-section${sectionNum}`;
    }
    return `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${titleNum}`;
  }
  return `https://uscode.house.gov/view.xhtml?req=${encodeURIComponent(identifier)}`;
}

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

/**
 * Render a table node to Markdown.
 * Simple tables (no colspan/rowspan) → Markdown pipe table.
 * Complex tables → skipped with a placeholder comment.
 */
function renderTable(node: TableNode): string {
  // Determine column count from the widest row
  const allRows = [...node.headers, ...node.rows];
  if (allRows.length === 0) return "";

  let colCount = 0;
  for (const row of allRows) {
    if (row.length > colCount) colCount = row.length;
  }

  if (colCount === 0) return "";

  // Build the Markdown table
  const lines: string[] = [];

  // Use the last header row as the actual column headers (skip title rows with colspan)
  // If no usable header rows, use the first body row as implicit header
  let headerRow: string[] | undefined;
  for (let i = node.headers.length - 1; i >= 0; i--) {
    const row = node.headers[i];
    if (row && row.length === colCount) {
      headerRow = row;
      break;
    }
  }

  if (!headerRow) {
    // No header row matching column count — use empty headers
    headerRow = Array.from({ length: colCount }, () => "");
  }

  // Header line
  lines.push(`| ${headerRow.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`);

  // Separator line
  lines.push(`| ${Array.from({ length: colCount }, () => "---").join(" | ")} |`);

  // Body rows
  for (const row of node.rows) {
    // Pad row to column count if needed
    const paddedRow = Array.from({ length: colCount }, (_, i) => row[i] ?? "");
    lines.push(`| ${paddedRow.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Source credit rendering
// ---------------------------------------------------------------------------

/**
 * Render a source credit node.
 * Format: horizontal rule, then bold label with text.
 */
function renderSourceCredit(node: SourceCreditNode, options: RenderOptions): string {
  const text = renderInlineChildren(node.children, options);
  return `---\n\n**Source Credit**: ${text}`;
}

// ---------------------------------------------------------------------------
// Notes rendering
// ---------------------------------------------------------------------------

/**
 * Render a notes container (<notes type="uscNote">).
 */
function renderNotesContainer(node: NotesContainerNode, options: RenderOptions): string {
  const filter = options.notesFilter;

  // No filter = include everything (default behavior)
  if (!filter) {
    const parts: string[] = [];
    for (const child of node.children) {
      const rendered = renderNode(child, options);
      if (rendered) {
        parts.push(rendered);
      }
    }
    return parts.join("\n\n");
  }

  // Filter notes by category
  const parts: string[] = [];
  let currentCategory: "editorial" | "statutory" | "unknown" = "unknown";

  for (const child of node.children) {
    if (child.type !== "note") {
      const rendered = renderNode(child, options);
      if (rendered) parts.push(rendered);
      continue;
    }

    // Cross-heading notes set the category
    if (child.role === "crossHeading") {
      if (child.topic === "editorialNotes") {
        currentCategory = "editorial";
      } else if (child.topic === "statutoryNotes") {
        currentCategory = "statutory";
      }
      // Only render the heading if we'll include notes in this category
      if (shouldIncludeCategory(currentCategory, filter)) {
        const rendered = renderNode(child, options);
        if (rendered) parts.push(rendered);
      }
      continue;
    }

    // Regular notes — check if their topic/category passes the filter
    if (shouldIncludeNote(child, currentCategory, filter)) {
      const rendered = renderNode(child, options);
      if (rendered) parts.push(rendered);
    }
  }

  return parts.join("\n\n");
}

/** Amendment-related topics */
const AMENDMENT_TOPICS = new Set([
  "amendments",
  "effectiveDateOfAmendment",
  "shortTitleOfAmendment",
]);

/** Editorial-specific topics */
const EDITORIAL_TOPICS = new Set([
  "codification",
  "dispositionOfSections",
]);

/** Statutory-specific topics */
const STATUTORY_TOPICS = new Set([
  "changeOfName",
  "regulations",
  "miscellaneous",
  "repeals",
  "separability",
  "crossReferences",
]);

/**
 * Check if a category of notes should be included based on the filter.
 */
function shouldIncludeCategory(
  category: "editorial" | "statutory" | "unknown",
  filter: NotesFilter,
): boolean {
  if (category === "editorial") return filter.editorial || filter.amendments;
  if (category === "statutory") return filter.statutory || filter.amendments;
  // Unknown category — include if any filter is enabled
  return filter.editorial || filter.statutory || filter.amendments;
}

/**
 * Check if an individual note should be included based on its topic and category.
 */
function shouldIncludeNote(
  node: NoteNode,
  currentCategory: "editorial" | "statutory" | "unknown",
  filter: NotesFilter,
): boolean {
  const topic = node.topic ?? "";

  // Amendment topics included by amendments filter
  if (AMENDMENT_TOPICS.has(topic)) return filter.amendments;

  // Topic-specific classification takes precedence over category
  if (EDITORIAL_TOPICS.has(topic)) return filter.editorial;
  if (STATUTORY_TOPICS.has(topic)) return filter.statutory;

  // Fall back to category from cross-heading
  if (currentCategory === "editorial") return filter.editorial;
  if (currentCategory === "statutory") return filter.statutory;

  // Unknown — include if any filter is active
  return filter.editorial || filter.statutory || filter.amendments;
}

/**
 * Render a note node.
 */
function renderNote(node: NoteNode, options: RenderOptions): string {
  const parts: string[] = [];

  // Cross-heading notes become H2 headings
  if (node.role === "crossHeading" && node.heading) {
    parts.push(`## ${node.heading}`);
    return parts.join("\n\n");
  }

  // Regular notes with a heading become H3
  if (node.heading) {
    parts.push(`### ${node.heading}`);
  }

  // Render note children
  for (const child of node.children) {
    const rendered = renderNode(child, options);
    if (rendered) {
      parts.push(rendered);
    }
  }

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Quoted content rendering
// ---------------------------------------------------------------------------

/**
 * Render quoted content as a Markdown blockquote.
 */
function renderQuotedContent(node: QuotedContentNode, options: RenderOptions): string {
  const parts: string[] = [];

  for (const child of node.children) {
    const rendered = renderNode(child, options);
    if (rendered) {
      parts.push(rendered);
    }
  }

  const inner = parts.join("\n\n");
  // Prefix each line with > for blockquote
  return inner
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}
