# AST Model

The LexBuild AST is a semantic intermediate representation between raw XML and rendered Markdown. It is not a 1:1 mapping of XML elements -- it is a partially interpreted tree that captures the structural and textual meaning needed for rendering. Source packages produce AST nodes from their respective XML formats; the core renderer consumes them to generate Markdown. This producer/consumer split allows multiple legal sources to share a single rendering pipeline.

All AST types are defined in `packages/core/src/ast/types.ts` and exported from `@lexbuild/core`.

## Purpose

Legislative XML schemas contain dozens of element types, namespace variations, and structural patterns that are irrelevant to Markdown rendering. The AST collapses this complexity into a small set of typed nodes:

- Structural elements map to `LevelNode`
- Text blocks map to `ContentNode`
- Inline formatting maps to `InlineNode`
- Annotations map to `NoteNode` and `SourceCreditNode`
- Tabular data maps to `TableNode`

Both USLM (for U.S. Code) and GPO/SGML (for eCFR) XML are mapped to these same node types, so the renderer operates on AST nodes without knowing which source produced them.

## Transformation Overview

```
XML Source              AST                     Markdown Output
─────────────────────   ─────────────────────   ──────────────────────────
<section>            →  LevelNode            →  # Section Heading
  <num>                   .num, .numValue         (heading text)
  <heading>               .heading
  <content>          →  ContentNode          →  Paragraph text with
    <ref>                 InlineNode(ref)         [link](path.md)
    text                  InlineNode(text)        plain text
  <subsection>       →  LevelNode            →  **(a)** Subsection
    <chapeau>          →  ContentNode          →  Introductory text--
    <paragraph>        →  LevelNode            →  **(1)** Paragraph text
  <sourceCredit>     →  SourceCreditNode     →  (Pub. L. 111-350, ...)
  <notes>            →  NotesContainerNode
    <note>           →    NoteNode           →  ### Editorial Notes
```

Each source package has its own builder that converts SAX events into this tree structure. The USLM builder (`ASTBuilder` in `@lexbuild/core`) handles U.S. Code XML. The eCFR builder (`EcfrASTBuilder` in `@lexbuild/ecfr`) handles GPO/SGML XML. Both produce the same node types, and both feed the same renderer in `@lexbuild/core`.

## Node Types

### BaseNode

All nodes extend the `BaseNode` interface:

```typescript
interface BaseNode {
  readonly type: string;       // Discriminator for the node type
  identifier?: string;         // USLM/CFR URI (e.g., "/us/usc/t1/s1")
  sourceElement?: string;      // Original XML element name (debugging)
}
```

The `type` field is the discriminator for TypeScript's discriminated union. The `identifier` carries the canonical URI when one exists in the source XML. The `sourceElement` preserves the original element name for diagnostic output.

### LevelNode

Represents any hierarchical level in the document structure -- from an entire title down to a subsubitem.

```typescript
interface LevelNode extends BaseNode {
  readonly type: "level";
  levelType: LevelType;        // Which level in the hierarchy
  num?: string;                // Display text (e.g., "§ 1.", "(a)")
  numValue?: string;           // Normalized value (e.g., "1", "a")
  heading?: string;            // Heading text
  status?: string;             // Legal status (e.g., "repealed")
  children: ASTNode[];         // Child nodes
}
```

The 26 level types are organized into three groups:

**Big levels** (17 types, above section): `title`, `appendix`, `subtitle`, `chapter`, `subchapter`, `compiledAct`, `reorganizationPlans`, `reorganizationPlan`, `courtRules`, `courtRule`, `article`, `subarticle`, `part`, `subpart`, `division`, `subdivision`, `preliminary`

**Primary level**: `section`

**Small levels** (8 types, below section): `subsection`, `paragraph`, `subparagraph`, `clause`, `subclause`, `item`, `subitem`, `subsubitem`

These groups are exported as `BIG_LEVELS` and `SMALL_LEVELS` sets, and the full ordered list as the `LEVEL_TYPES` array.

The renderer treats these groups differently: big levels produce Markdown headings (H1 through H5, capped to avoid H6), while small levels use bold inline numbering (e.g., `**(a)** Text...`). The section level itself produces the top-level heading of a section file.

### ContentNode

A block of text content within a level.

```typescript
interface ContentNode extends BaseNode {
  readonly type: "content";
  variant: ContentVariant;     // "content" | "chapeau" | "continuation" | "proviso"
  children: InlineNode[];      // Inline children (text, formatting, refs)
}
```

The four variants correspond to distinct roles in legal text:

| Variant | XML Element | Role |
|---|---|---|
| `content` | `<content>` | Standard text block |
| `chapeau` | `<chapeau>` | Introductory text before sub-levels |
| `continuation` | `<continuation>` | Text after or between sub-levels |
| `proviso` | `<proviso>` | "Provided that..." conditional text |

All four variants render as plain paragraph text in Markdown. The distinction is preserved in the AST for consumers that need to distinguish these roles.

### InlineNode

Inline text and formatting within content blocks. InlineNodes can nest (e.g., bold text inside a reference).

```typescript
interface InlineNode extends BaseNode {
  readonly type: "inline";
  inlineType: InlineType;      // Discriminator for inline kind
  text?: string;               // Text content (leaf nodes)
  href?: string;               // Link target (ref nodes)
  idref?: string;              // Footnote target ID (footnoteRef nodes)
  children?: InlineNode[];     // Nested inline children
}
```

The inline type determines how the node renders to Markdown:

| XML Element | `inlineType` | Markdown Output |
|---|---|---|
| plain text | `text` | literal text |
| `<b>` | `bold` | `**text**` |
| `<i>` | `italic` | `*text*` |
| `<ref>` | `ref` | `[text](path)` or plain text |
| `<date>` | `date` | literal text |
| `<term>` | `term` | `**text**` (bold, same as defined terms) |
| `<quotedContent>` (inline) | `quoted` | `"text"` |
| `<sup>` | `sup` | `<sup>text</sup>` |
| `<sub>` | `sub` | `<sub>text</sub>` |
| `<ref class="footnoteRef">` | `footnoteRef` | `[^id]` |
| `<inline>`, `<shortTitle>`, `<del>`, `<ins>` | `text` | pass-through |

Leaf nodes use the `text` field. Non-leaf nodes use `children` to hold nested inline content. The `href` field is specific to `ref` nodes and carries the cross-reference URI. The `idref` field is specific to `footnoteRef` nodes and identifies the target footnote.

### NoteNode

Editorial notes, statutory notes, and amendment history.

```typescript
interface NoteNode extends BaseNode {
  readonly type: "note";
  topic?: string;              // Semantic category
  role?: string;               // Role refinement (e.g., "crossHeading")
  noteType?: string;           // Placement type
  heading?: string;            // Heading text
  children: ASTNode[];         // Child nodes
}
```

Notes have two independent classification axes:

**noteType** (placement): `uscNote`, `footnote`, `inline`, `endnote`

**topic** (semantic category): `amendments`, `codification`, `changeOfName`, `crossReferences`, `effectiveDateOfAmendment`, `miscellaneous`, `repeals`, `regulations`, `dispositionOfSections`, `enacting`

The `role` field with value `"crossHeading"` marks notes that act as section dividers within a notes container. A cross-heading note with heading "Editorial Notes" or "Statutory Notes" establishes the category for all subsequent notes until the next cross-heading. The renderer uses this to support selective notes filtering without modifying the AST.

### SourceCreditNode

Enactment source citations (e.g., public law references).

```typescript
interface SourceCreditNode extends BaseNode {
  readonly type: "sourceCredit";
  children: InlineNode[];      // Full citation with inline formatting
}
```

Rendered as a horizontal rule followed by a bold "Source Credit" label and the citation text.

### TableNode

Both XHTML tables and USLM layout tables.

```typescript
interface TableNode extends BaseNode {
  readonly type: "table";
  variant: "xhtml" | "layout"; // Which table model
  headers: string[][];         // Header rows (array of cell arrays)
  rows: string[][];            // Body rows
  rawHtml?: string;            // Raw HTML for tables too complex to decompose
}
```

The `variant` distinguishes XHTML namespace `<table>` elements (common in USC XML) from USLM `<layout>`/`<column>` elements. Both are normalized into the same row/column structure. Tables that cannot be simplified to rows and columns (e.g., those with colspan or rowspan) fall back to `rawHtml`. Simple tables render as Markdown pipe tables.

### TOCNode and TOCItemNode

Table of contents structures.

```typescript
interface TOCNode extends BaseNode {
  readonly type: "toc";
  items: TOCItemNode[];
}

interface TOCItemNode extends BaseNode {
  readonly type: "tocItem";
  number?: string;             // Section/chapter number
  title?: string;              // Heading text
  href?: string;               // Link target identifier
}
```

Present in the AST for completeness but skipped during Markdown rendering. The TOC structures in the source XML are navigational aids that do not contribute to the legal text content.

### NotesContainerNode

Wraps `<notes type="uscNote">` containers.

```typescript
interface NotesContainerNode extends BaseNode {
  readonly type: "notesContainer";
  notesType?: string;          // The notes type attribute (e.g., "uscNote")
  children: (NoteNode | ASTNode)[];
}
```

Children include `NoteNode` entries with cross-heading role acting as category dividers. The renderer walks the children sequentially, tracking the current category set by cross-headings and applying the notes filter to decide which notes to include.

### QuotedContentNode

Quoted legal text, typically quoted bills embedded in statutory notes.

```typescript
interface QuotedContentNode extends BaseNode {
  readonly type: "quotedContent";
  origin?: string;             // Source of the quotation
  children: ASTNode[];
}
```

Rendered as a Markdown blockquote (each line prefixed with `>`). Sections that appear inside quoted content are suppressed during emission -- the builder tracks a `quotedContentDepth` counter to prevent quoted sections from being written as standalone output files.

## The Complete Union Type

```typescript
type ASTNode =
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
```

The renderer dispatches on `node.type` via a switch statement. TypeScript's discriminated union ensures exhaustive handling -- adding a new node type without a corresponding render case produces a compile-time error.

## Context Types

### EmitContext

Provided to the emission callback when a completed section, chapter, or title subtree is ready for output.

```typescript
interface EmitContext {
  ancestors: AncestorInfo[];   // Ancestor chain from document root
  documentMeta: DocumentMeta;  // Document-level metadata from <meta>
}
```

The `ancestors` array provides the full hierarchy path from the document root to the emitted node's parent. This gives the output writer enough context to determine file paths, generate frontmatter, and resolve relative links without holding the entire document tree in memory.

### AncestorInfo

A lightweight snapshot of an ancestor level, carrying only what downstream consumers need.

```typescript
interface AncestorInfo {
  levelType: LevelType;        // e.g., "title", "chapter"
  numValue?: string;           // Normalized number value
  heading?: string;            // Heading text
  identifier?: string;         // USLM/CFR identifier
}
```

### DocumentMeta

Metadata extracted from the XML `<meta>` block. Held in memory for the full duration of parsing and included in every `EmitContext`.

```typescript
interface DocumentMeta {
  dcTitle?: string;            // dc:title (e.g., "Title 1")
  dcType?: string;             // dc:type (e.g., "USCTitle")
  docNumber?: string;          // Numeric designation (e.g., "1")
  docPublicationName?: string; // Publication name
  releasePoint?: string;       // Release point identifier (e.g., "119-73")
  positivelaw?: boolean;       // Whether this is positive law
  publisher?: string;          // dc:publisher
  created?: string;            // dcterms:created (ISO timestamp)
  creator?: string;            // dc:creator (generator tool name)
  identifier?: string;         // Root document identifier (e.g., "/us/usc/t1")
}
```

## Frontmatter Types

### SourceType and LegalStatus

Every output file carries a `source` discriminator and a `legal_status` classification:

```typescript
type SourceType = "usc" | "ecfr";

type LegalStatus =
  | "official_legal_evidence"      // USC positive law titles
  | "official_prima_facie"         // USC non-positive law titles
  | "authoritative_unofficial";    // eCFR-sourced content
```

The `SourceType` union is designed for extension -- future sources (annual CFR, Federal Register, state statutes) will add new values.

### FrontmatterData

The complete set of fields used to generate YAML frontmatter for output files. Required fields appear on every file; optional fields are included when applicable.

```typescript
interface FrontmatterData {
  // Required fields
  source: SourceType;
  legal_status: LegalStatus;
  identifier: string;             // Canonical URI
  title: string;                  // Human-readable display title
  title_number: number;
  title_name: string;
  positive_law: boolean;
  currency: string;               // Release point or date
  last_updated: string;           // ISO date

  // Structural context (included when applicable)
  chapter_number?: number;
  chapter_name?: string;
  subchapter_number?: string;
  subchapter_name?: string;
  part_number?: string;
  part_name?: string;
  section_number?: string;        // String -- can be alphanumeric (e.g., "7801")
  section_name?: string;

  // Optional metadata
  source_credit?: string;
  status?: string;                // e.g., "repealed", "transferred"

  // Title-level granularity fields
  chapter_count?: number;
  section_count?: number;
  total_token_estimate?: number;

  // eCFR/CFR-specific fields
  authority?: string;             // Regulatory authority citation
  regulatory_source?: string;     // Source/provenance note
  agency?: string;                // Responsible agency
  cfr_part?: string;              // Part number (e.g., "240")
  cfr_subpart?: string;           // Subpart identifier
  part_count?: number;            // Part count (title-level, eCFR)
}
```

The frontmatter generator (`packages/core/src/markdown/frontmatter.ts`) serializes this to YAML with controlled field ordering. Two constants are appended automatically: `FORMAT_VERSION` (currently `"1.1.0"`) and `GENERATOR` (e.g., `"lexbuild@0.5.0"`).
