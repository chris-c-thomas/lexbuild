---
title: AST Model
description: LexBuild's semantic AST node types, how XML elements map to typed nodes, and how the source-agnostic intermediate representation enables multi-source rendering.
order: 3
---

The LexBuild AST is a semantic intermediate representation between raw XML and rendered Markdown. It is not a 1:1 mapping of XML elements. Instead, it is a partially interpreted tree that captures the structural and textual meaning needed for rendering. Source packages produce AST nodes from their respective XML formats; the core renderer consumes them to generate Markdown. This producer/consumer split allows multiple legal sources to share a single rendering pipeline.

All AST types are defined in `packages/core/src/ast/types.ts` and exported from `@lexbuild/core`.

## Why an AST Layer

Legislative XML schemas contain dozens of element types, namespace variations, and structural patterns that are irrelevant to Markdown rendering. The AST collapses this complexity into a small set of typed nodes:

- Structural elements map to `LevelNode`
- Text blocks map to `ContentNode`
- Inline formatting maps to `InlineNode`
- Annotations map to `NoteNode` and `SourceCreditNode`
- Tabular data maps to `TableNode`

Both USLM (for U.S. Code) and GPO/SGML (for eCFR and FR) XML are mapped to these same node types. The renderer operates on AST nodes without knowing which source produced them.

## Transformation Overview

```
XML Source              AST                     Markdown Output
<section>            -> LevelNode            -> # Section Heading
  <num>                  .num, .numValue
  <heading>              .heading
  <content>          -> ContentNode          -> Paragraph text with
    <ref>                InlineNode(ref)         [link](path.md)
    text                 InlineNode(text)        plain text
  <subsection>       -> LevelNode            -> **(a)** Subsection
    <chapeau>        -> ContentNode          -> Introductory text--
    <paragraph>      -> LevelNode            -> **(1)** Paragraph text
  <sourceCredit>     -> SourceCreditNode     -> (Pub. L. 111-350, ...)
  <notes>            -> NotesContainerNode
    <note>           -> NoteNode             -> ### Editorial Notes
```

## Node Types

### BaseNode

All nodes extend the `BaseNode` interface:

```typescript
interface BaseNode {
  readonly type: string;       // Discriminator for the node type
  identifier?: string;         // Canonical URI (e.g., "/us/usc/t1/s1")
  sourceElement?: string;      // Original XML element name (for diagnostics)
}
```

The `type` field is the discriminator for TypeScript's discriminated union. The `identifier` carries the canonical URI when one exists in the source XML. The `sourceElement` preserves the original element name for debugging.

### LevelNode

Represents any hierarchical level in the document structure, from an entire title down to a subsubitem.

```typescript
interface LevelNode extends BaseNode {
  readonly type: "level";
  levelType: LevelType;        // Which level in the hierarchy
  num?: string;                // Display text (e.g., "ss 1.", "(a)")
  numValue?: string;           // Normalized value (e.g., "1", "a")
  heading?: string;            // Heading text
  status?: string;             // Legal status (e.g., "repealed")
  children: ASTNode[];         // Child nodes
}
```

The 26 level types are organized into three groups:

**Big levels (17 types, above section):** `title`, `appendix`, `subtitle`, `chapter`, `subchapter`, `compiledAct`, `reorganizationPlans`, `reorganizationPlan`, `courtRules`, `courtRule`, `article`, `subarticle`, `part`, `subpart`, `division`, `subdivision`, `preliminary`

**Primary level:** `section`

**Small levels (8 types, below section):** `subsection`, `paragraph`, `subparagraph`, `clause`, `subclause`, `item`, `subitem`, `subsubitem`

These groups are exported as `BIG_LEVELS` and `SMALL_LEVELS` sets, and the full ordered list as the `LEVEL_TYPES` array.

The renderer treats these groups differently. Big levels produce Markdown headings (H1 through H5, capped to avoid overuse of deep heading levels). Small levels use bold inline numbering (for example, `**(a)** Text...`). The section level itself produces the top-level heading of a section file.

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

| Variant | Role |
|---|---|
| `content` | Standard text block |
| `chapeau` | Introductory text before sub-levels (e.g., "The following conditions apply--") |
| `continuation` | Text after or between sub-levels |
| `proviso` | "Provided that..." conditional text |

All four variants render as plain paragraph text in Markdown. The distinction is preserved in the AST for consumers that need to differentiate these roles.

### InlineNode

Inline text and formatting within content blocks. InlineNodes can nest (for example, bold text inside a reference).

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

| Inline Type | Markdown Output |
|---|---|
| `text` | Literal text |
| `bold` | `**text**` |
| `italic` | `*text*` |
| `ref` | `[text](path)` or plain text (depending on link resolution) |
| `date` | Literal text |
| `term` | `**text**` (bold, same as defined terms) |
| `quoted` | `"text"` |
| `sup` | `<sup>text</sup>` |
| `sub` | `<sub>text</sub>` |
| `footnoteRef` | `[^id]` |

Leaf nodes use the `text` field. Non-leaf nodes use `children` to hold nested inline content. The `href` field is specific to `ref` nodes and carries the cross-reference URI.

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

- **noteType** (placement): `uscNote`, `footnote`, `inline`, `endnote`
- **topic** (semantic category): `amendments`, `codification`, `changeOfName`, `crossReferences`, `effectiveDateOfAmendment`, `miscellaneous`, `repeals`, `regulations`, `dispositionOfSections`, `enacting`

The `role` field with value `"crossHeading"` marks notes that act as section dividers within a notes container. A cross-heading note with heading "Editorial Notes" or "Statutory Notes" establishes the category for subsequent notes until the next cross-heading. The renderer uses this to support selective notes filtering without modifying the AST.

### SourceCreditNode

Enactment source citations (such as public law references).

```typescript
interface SourceCreditNode extends BaseNode {
  readonly type: "sourceCredit";
  children: InlineNode[];
}
```

Rendered as a horizontal rule followed by a bold "Source Credit" label and the citation text.

### TableNode

Both XHTML tables and USLM layout tables.

```typescript
interface TableNode extends BaseNode {
  readonly type: "table";
  variant: "xhtml" | "layout";
  headers: string[][];         // Header rows (array of cell arrays)
  rows: string[][];            // Body rows
  rawHtml?: string;            // Fallback for tables too complex to decompose
}
```

The `variant` distinguishes XHTML namespace `<table>` elements (common in USC XML) from USLM `<layout>`/`<column>` elements. Both are normalized into the same row/column structure. Tables that cannot be simplified to rows and columns (those with colspan or rowspan) fall back to `rawHtml`. Simple tables render as Markdown pipe tables.

### Other Node Types

- **`TOCNode`** and **`TOCItemNode`** -- Table of contents structures. Present in the AST for completeness but skipped during Markdown rendering, since TOC structures in the source XML are navigational aids rather than legal text content.
- **`NotesContainerNode`** -- Wraps `<notes>` containers. Children include `NoteNode` entries with cross-heading roles acting as category dividers.
- **`QuotedContentNode`** -- Quoted legal text, typically quoted bills embedded in statutory notes. Rendered as a Markdown blockquote. Sections inside quoted content are suppressed during emission to prevent them from being written as standalone output files.

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

## Source Type Discriminator

Every output file carries a `source` discriminator and a `legal_status` classification:

```typescript
type SourceType = "usc" | "ecfr" | "fr";

type LegalStatus =
  | "official_legal_evidence"      // USC positive law titles
  | "official_prima_facie"         // USC non-positive law titles
  | "authoritative_unofficial";    // eCFR and FR content
```

The `SourceType` union is designed for extension. Adding a new source means adding a new value here.

## FrontmatterData

The `FrontmatterData` interface defines all fields used to generate YAML frontmatter for output files. Required fields appear on every file; optional fields are included when applicable.

Required fields include `source`, `legal_status`, `identifier` (canonical URI), `title`, `title_number`, `title_name`, `currency`, and `last_updated`. Structural context fields like `chapter_number`, `section_number`, and `part_number` are included when the hierarchy provides them.

Source-specific optional fields cover eCFR metadata (`authority`, `agency`, `cfr_part`) and FR metadata (`document_number`, `document_type`, `fr_citation`, `agencies`, `effective_date`). Two constants are appended automatically: `FORMAT_VERSION` and `GENERATOR`.

## Context Types

### EmitContext

When the builder emits a completed subtree, it provides an `EmitContext`:

```typescript
interface EmitContext {
  ancestors: AncestorInfo[];   // Ancestor chain from document root
  documentMeta: DocumentMeta;  // Document-level metadata
}
```

The `ancestors` array gives you the full hierarchy path from the document root to the emitted node's parent. This provides enough context for determining file paths, generating frontmatter, and resolving relative links -- all without holding the entire document tree in memory.

### AncestorInfo

A lightweight snapshot of an ancestor level:

```typescript
interface AncestorInfo {
  levelType: LevelType;
  numValue?: string;
  heading?: string;
  identifier?: string;
}
```

### DocumentMeta

Metadata extracted from the XML `<meta>` block. Held in memory for the full duration of parsing and included in every `EmitContext`. Contains fields like `dcTitle`, `docNumber`, `releasePoint`, `positivelaw`, and the root document `identifier`.
