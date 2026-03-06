/**
 * @lexbuild/core AST node types
 *
 * The intermediate AST is a semantic representation of parsed USLM XML.
 * It is NOT a 1:1 mapping — it has been partially interpreted to simplify rendering.
 */

/** All hierarchical levels in the USLM schema, ordered big → small */
export const LEVEL_TYPES = [
  // Big levels (above section)
  "title",
  "appendix",
  "subtitle",
  "chapter",
  "subchapter",
  "compiledAct",
  "reorganizationPlans",
  "reorganizationPlan",
  "courtRules",
  "courtRule",
  "article",
  "subarticle",
  "part",
  "subpart",
  "division",
  "subdivision",
  "preliminary",
  // Primary level
  "section",
  // Small levels (below section)
  "subsection",
  "paragraph",
  "subparagraph",
  "clause",
  "subclause",
  "item",
  "subitem",
  "subsubitem",
] as const;

/** A USLM hierarchical level type */
export type LevelType = (typeof LEVEL_TYPES)[number];

/** Big levels: above section in the hierarchy */
export const BIG_LEVELS = new Set<LevelType>([
  "title",
  "appendix",
  "subtitle",
  "chapter",
  "subchapter",
  "compiledAct",
  "reorganizationPlans",
  "reorganizationPlan",
  "courtRules",
  "courtRule",
  "article",
  "subarticle",
  "part",
  "subpart",
  "division",
  "subdivision",
  "preliminary",
]);

/** Small levels: below section in the hierarchy */
export const SMALL_LEVELS = new Set<LevelType>([
  "subsection",
  "paragraph",
  "subparagraph",
  "clause",
  "subclause",
  "item",
  "subitem",
  "subsubitem",
]);

/** Base node all AST nodes extend */
export interface BaseNode {
  /** Discriminator for the node type */
  readonly type: string;
  /** USLM identifier if present (e.g., "/us/usc/t1/s1") */
  identifier?: string | undefined;
  /** Source XML element name for debugging */
  sourceElement?: string | undefined;
}

/** A hierarchical level (title, chapter, section, subsection, etc.) */
export interface LevelNode extends BaseNode {
  readonly type: "level";
  /** Which level in the USLM hierarchy */
  levelType: LevelType;
  /** Display text of the number (e.g., "§ 1.", "(a)", "CHAPTER 1—") */
  num?: string | undefined;
  /** Normalized value of the number (e.g., "1", "a") */
  numValue?: string | undefined;
  /** Heading text (e.g., "Words denoting number, gender, and so forth") */
  heading?: string | undefined;
  /** Legal status of this element (e.g., "repealed", "transferred") */
  status?: string | undefined;
  /** Child nodes */
  children: ASTNode[];
}

/** Variant of a content block */
export type ContentVariant = "content" | "chapeau" | "continuation" | "proviso";

/** A block of text content */
export interface ContentNode extends BaseNode {
  readonly type: "content";
  /** What kind of content block this is */
  variant: ContentVariant;
  /** Inline children (text, formatting, refs) */
  children: InlineNode[];
}

/** Discriminator for inline node types */
export type InlineType =
  | "text"
  | "bold"
  | "italic"
  | "ref"
  | "date"
  | "term"
  | "quoted"
  | "sup"
  | "sub"
  | "footnoteRef";

/** Inline text or formatting */
export interface InlineNode extends BaseNode {
  readonly type: "inline";
  /** What kind of inline this is */
  inlineType: InlineType;
  /** Text content (for leaf text nodes) */
  text?: string | undefined;
  /** Link target (for ref nodes) */
  href?: string | undefined;
  /** Footnote target ID (for footnoteRef nodes) */
  idref?: string | undefined;
  /** Nested inline children */
  children?: InlineNode[] | undefined;
}

/** A note (editorial, statutory, amendment, etc.) */
export interface NoteNode extends BaseNode {
  readonly type: "note";
  /** Semantic category (e.g., "amendments", "codification") */
  topic?: string | undefined;
  /** Role refinement (e.g., "crossHeading") */
  role?: string | undefined;
  /** Note placement type (e.g., "uscNote", "footnote") */
  noteType?: string | undefined;
  /** Heading text of the note */
  heading?: string | undefined;
  /** Child nodes */
  children: ASTNode[];
}

/** Source credit annotation */
export interface SourceCreditNode extends BaseNode {
  readonly type: "sourceCredit";
  /** The full source credit text, including inline formatting */
  children: InlineNode[];
}

/** Table (either XHTML or USLM layout-based) */
export interface TableNode extends BaseNode {
  readonly type: "table";
  /** Which table model */
  variant: "xhtml" | "layout";
  /** Header rows (each row is an array of cell strings) */
  headers: string[][];
  /** Body rows */
  rows: string[][];
  /** Raw HTML for complex tables that can't be simplified to rows/columns */
  rawHtml?: string | undefined;
}

/** A single TOC entry */
export interface TOCItemNode extends BaseNode {
  readonly type: "tocItem";
  /** Section/chapter number */
  number?: string | undefined;
  /** Title or heading text */
  title?: string | undefined;
  /** Link target identifier */
  href?: string | undefined;
}

/** Table of contents */
export interface TOCNode extends BaseNode {
  readonly type: "toc";
  /** TOC entries */
  items: TOCItemNode[];
}

/** Container for notes (wraps <notes type="uscNote">) */
export interface NotesContainerNode extends BaseNode {
  readonly type: "notesContainer";
  /** The notes type attribute (e.g., "uscNote") */
  notesType?: string | undefined;
  /** Child note nodes */
  children: (NoteNode | ASTNode)[];
}

/** Quoted content (blockquote) */
export interface QuotedContentNode extends BaseNode {
  readonly type: "quotedContent";
  /** Where the quote originates from */
  origin?: string | undefined;
  /** Content of the quotation */
  children: ASTNode[];
}

/** Union of all AST node types */
export type ASTNode =
  | LevelNode
  | ContentNode
  | InlineNode
  | NoteNode
  | SourceCreditNode
  | TableNode
  | TOCNode
  | TOCItemNode
  | NotesContainerNode
  | QuotedContentNode;

// ---------------------------------------------------------------------------
// Context types used during AST building and rendering
// ---------------------------------------------------------------------------

/** Info about an ancestor level in the hierarchy */
export interface AncestorInfo {
  /** The level type (e.g., "title", "chapter") */
  levelType: LevelType;
  /** Normalized number value */
  numValue?: string | undefined;
  /** Heading text */
  heading?: string | undefined;
  /** USLM identifier */
  identifier?: string | undefined;
}

/** Document-level metadata extracted from the <meta> block */
export interface DocumentMeta {
  /** dc:title — display title (e.g., "Title 1") */
  dcTitle?: string | undefined;
  /** dc:type — document type (e.g., "USCTitle") */
  dcType?: string | undefined;
  /** docNumber — numeric designation (e.g., "1") */
  docNumber?: string | undefined;
  /** docPublicationName — publication name */
  docPublicationName?: string | undefined;
  /** Release point identifier (e.g., "119-73") */
  releasePoint?: string | undefined;
  /** Whether this is positive law */
  positivelaw?: boolean | undefined;
  /** dc:publisher */
  publisher?: string | undefined;
  /** dcterms:created — ISO timestamp */
  created?: string | undefined;
  /** dc:creator — generator tool name */
  creator?: string | undefined;
  /** The root document identifier (e.g., "/us/usc/t1") */
  identifier?: string | undefined;
}

/** Context provided when a completed section/chapter is emitted */
export interface EmitContext {
  /** Ancestor chain from document root to the emitted node's parent */
  ancestors: AncestorInfo[];
  /** Document-level metadata from the <meta> block */
  documentMeta: DocumentMeta;
}

// ---------------------------------------------------------------------------
// Frontmatter types
// ---------------------------------------------------------------------------

/** Data used to generate YAML frontmatter for a section file */
export interface FrontmatterData {
  /** USLM canonical identifier (e.g., "/us/usc/t1/s1") */
  identifier: string;
  /** Human-readable display title (e.g., "1 USC § 1 - Words denoting...") */
  title: string;
  /** Title number (integer) */
  title_number: number;
  /** Title name (e.g., "General Provisions") */
  title_name: string;
  /** Chapter number (integer, omitted if not applicable) */
  chapter_number?: number | undefined;
  /** Chapter name */
  chapter_name?: string | undefined;
  /** Subchapter identifier (often Roman numerals) */
  subchapter_number?: string | undefined;
  /** Subchapter name */
  subchapter_name?: string | undefined;
  /** Part identifier */
  part_number?: string | undefined;
  /** Part name */
  part_name?: string | undefined;
  /** Section number (string — can be alphanumeric like "7801"). Omitted for title-level output. */
  section_number?: string | undefined;
  /** Section name. Omitted for title-level output. */
  section_name?: string | undefined;
  /** Whether this title is positive law */
  positive_law: boolean;
  /** Full source credit text */
  source_credit?: string | undefined;
  /** Release point identifier (e.g., "119-73") */
  currency: string;
  /** ISO date from XML generation timestamp */
  last_updated: string;
  /** Section status (e.g., "repealed", "transferred") */
  status?: string | undefined;
  /** Number of chapters (title-level granularity only) */
  chapter_count?: number | undefined;
  /** Number of sections (title-level granularity only) */
  section_count?: number | undefined;
  /** Total estimated tokens (title-level granularity only) */
  total_token_estimate?: number | undefined;
}
