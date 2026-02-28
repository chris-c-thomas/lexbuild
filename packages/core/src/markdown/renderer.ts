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
  NotesContainerNode,
  QuotedContentNode,
  FrontmatterData,
} from "../ast/types.js";
import { SMALL_LEVELS } from "../ast/types.js";
import { generateFrontmatter } from "./frontmatter.js";

/** Options for controlling Markdown rendering */
export interface RenderOptions {
  /** Heading level offset (0 = section is H1, 1 = section is H2) */
  headingOffset: number;
  /** How to render cross-references */
  linkStyle: "relative" | "canonical" | "plaintext";
  /** Function to resolve a USLM identifier to a relative file path (for linkStyle "relative") */
  resolveLink?: ((identifier: string) => string | null) | undefined;
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
    case "toc":
    case "tocItem":
    case "table":
      // Phase 2: tables and TOC rendering
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
 */
function renderContent(node: ContentNode): string {
  return renderInlineChildren(node.children);
}

/**
 * Render a list of inline nodes to a string.
 */
function renderInlineChildren(children: InlineNode[], options?: RenderOptions): string {
  return children.map((child) => renderInline(child, options)).join("");
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
  const parts: string[] = [];

  for (const child of node.children) {
    const rendered = renderNode(child, options);
    if (rendered) {
      parts.push(rendered);
    }
  }

  return parts.join("\n\n");
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
