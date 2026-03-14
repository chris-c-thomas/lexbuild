# AST Model

The LexBuild AST is an intermediate representation that sits between raw XML and rendered Markdown. It is a semantic representation of a legislative document -- not a 1:1 mapping of XML elements, but a partially interpreted tree that captures the structural and textual meaning needed for rendering. Source packages produce AST nodes from their respective XML formats; the core renderer consumes them to generate Markdown. This producer/consumer split is what allows multiple legal sources to share a single rendering pipeline.

## Purpose

Legislative XML schemas like USLM contain dozens of element types, namespace variations, and structural patterns that are irrelevant to Markdown rendering. The AST collapses this complexity into a small set of typed nodes:

- **Structural elements** (titles, chapters, sections, subsections) become `LevelNode`
- **Text blocks** (content, chapeau, continuation, proviso) become `ContentNode`
- **Inline formatting** (bold, italic, references, dates, terms) become `InlineNode`
- **Annotations** (notes, source credits) become `NoteNode` and `SourceCreditNode`
- **Tabular data** (XHTML tables, USLM layouts) become `TableNode`

This normalization means the renderer never needs to know whether the source was USLM 1.0, a future USLM 2.x, or an entirely different schema. It operates on AST nodes.

## Transformation Overview

```
     XML Source                    AST                      Markdown Output
  ─────────────────        ─────────────────           ──────────────────────

  <section>            →   LevelNode                →  # Section Heading
    <num>              →     .num, .numValue              (heading text)
    <heading>          →     .heading
    <content>          →   ContentNode              →  Paragraph text with
      <ref>            →     InlineNode(ref)        →    [link](path.md)
      text             →     InlineNode(text)       →    plain text
    <subsection>       →   LevelNode                →  ## (a) Subsection
      <chapeau>        →     ContentNode(chapeau)   →    Introductory text—
      <paragraph>      →     LevelNode              →  **(1)** Paragraph text
    <sourceCredit>     →   SourceCreditNode         →  (Pub. L. 111-350, ...)
    <notes>            →   NotesContainerNode       →
      <note>           →     NoteNode               →  ### Editorial Notes
```

## Node Types

All AST nodes extend a common `BaseNode` interface:

```typescript
interface BaseNode {
  readonly type: string;
  identifier?: string | undefined;
  sourceElement?: string | undefined;
}
```

The `type` field is the discriminator used for dispatch in the renderer and throughout the codebase. The optional `identifier` carries the USLM canonical URI (e.g., `/us/usc/t1/s1`) when the source element has one. The `sourceElement` field preserves the original XML element name for debugging.

### LevelNode

Represents any hierarchical level in the document structure: titles, chapters, sections, subsections, paragraphs, clauses, and everything in between.

```typescript
interface LevelNode extends BaseNode {
  readonly type: "level";
  levelType: LevelType;
  num?: string | undefined;
  numValue?: string | undefined;
  heading?: string | undefined;
  status?: string | undefined;
  children: ASTNode[];
}
```

The `levelType` field classifies where this level sits in the hierarchy. LexBuild defines 26 level types, split into three groups:

- **Big levels** (above section): `title`, `appendix`, `subtitle`, `chapter`, `subchapter`, `compiledAct`, `reorganizationPlans`, `reorganizationPlan`, `courtRules`, `courtRule`, `article`, `subarticle`, `part`, `subpart`, `division`, `subdivision`, `preliminary`
- **Primary level**: `section`
- **Small levels** (below section): `subsection`, `paragraph`, `subparagraph`, `clause`, `subclause`, `item`, `subitem`, `subsubitem`

The `num` field holds the display text (e.g., `"SS 1."`, `"(a)"`, `"CHAPTER 1--"`), while `numValue` holds the normalized value (e.g., `"1"`, `"a"`). The `status` field captures legal status values like `"repealed"`, `"transferred"`, or `"reserved"`.

These groups are exported as `BIG_LEVELS` and `SMALL_LEVELS` sets, and the full ordered list is available as `LEVEL_TYPES`. The renderer uses these to determine heading depth and formatting: big levels become Markdown headings (H1-H5, capped to avoid collision with the H6 used for sections), small levels use bold-numbered inline formatting.

### ContentNode

Represents a block of text content within a level. The `variant` field distinguishes the role of the text block in the legal structure:

```typescript
interface ContentNode extends BaseNode {
  readonly type: "content";
  variant: ContentVariant;
  children: InlineNode[];
}

type ContentVariant = "content" | "chapeau" | "continuation" | "proviso";
```

- **`content`** -- the primary text of a level element
- **`chapeau`** -- introductory text that precedes a list of sub-levels (e.g., "The following terms have the meanings given in this section--")
- **`continuation`** -- text that appears after or between sub-levels
- **`proviso`** -- "Provided that..." conditional text within a content block

### InlineNode

Represents inline text and formatting within content blocks. Inline nodes can nest (e.g., bold text containing a reference).

```typescript
interface InlineNode extends BaseNode {
  readonly type: "inline";
  inlineType: InlineType;
  text?: string | undefined;
  href?: string | undefined;
  idref?: string | undefined;
  children?: InlineNode[] | undefined;
}

type InlineType =
  | "text" | "bold" | "italic" | "ref" | "date"
  | "term" | "quoted" | "sup" | "sub" | "footnoteRef";
```

The `inlineType` discriminator maps from XML elements as follows:

| XML Element | `inlineType` | Markdown Output |
|-------------|--------------|-----------------|
| plain text | `text` | literal text |
| `<b>` | `bold` | `**text**` |
| `<i>` | `italic` | `*text*` |
| `<ref>` | `ref` | `[text](resolved-path)` or plain text |
| `<date>` | `date` | literal text |
| `<term>` | `term` | literal text |
| `<quotedContent>` (inline) | `quoted` | `"text"` |
| `<sup>` | `sup` | `<sup>text</sup>` |
| `<sub>` | `sub` | `<sub>text</sub>` |
| `<ref class="footnoteRef">` | `footnoteRef` | `[^id]` |
| `<inline>`, `<shortTitle>`, `<del>`, `<ins>` | `text` | pass-through (literal text) |

Leaf inline nodes carry their content in the `text` field. Non-leaf nodes (e.g., a bold node wrapping a reference) use `children`. Reference nodes carry their target in `href`; footnote reference nodes carry the footnote ID in `idref`.

### NoteNode

Represents editorial notes, statutory notes, amendment history, and other annotations attached to a section.

```typescript
interface NoteNode extends BaseNode {
  readonly type: "note";
  topic?: string | undefined;
  role?: string | undefined;
  noteType?: string | undefined;
  heading?: string | undefined;
  children: ASTNode[];
}
```

Notes have two independent classification axes from the USLM schema:

- **`noteType`** (placement): `"uscNote"`, `"footnote"`, `"inline"`, `"endnote"`
- **`topic`** (semantic category): `"amendments"`, `"codification"`, `"changeOfName"`, `"crossReferences"`, `"effectiveDateOfAmendment"`, `"miscellaneous"`, `"repeals"`, `"regulations"`, `"dispositionOfSections"`, `"enacting"`

The `role` field captures special roles like `"crossHeading"`, which marks notes that act as category dividers (e.g., "Editorial Notes", "Statutory Notes") within a `<notes>` container.

Notes are included by default and can be filtered at render time. The `NotesFilter` in `RenderOptions` controls which categories are included without modifying the AST. See [Conversion Pipeline](./conversion-pipeline.md) for how filtering integrates with the rendering stage.

### SourceCreditNode

Represents the enactment source citation that appears after a section's statutory text.

```typescript
interface SourceCreditNode extends BaseNode {
  readonly type: "sourceCredit";
  children: InlineNode[];
}
```

Rendered as a parenthetical citation, e.g., `(Pub. L. 111-350, SS 3, Jan. 4, 2011, 124 Stat. 3677.)`.

### TableNode

Represents tabular data from either XHTML tables (in the `http://www.w3.org/1999/xhtml` namespace) or USLM layout tables (`<layout>` elements).

```typescript
interface TableNode extends BaseNode {
  readonly type: "table";
  variant: "xhtml" | "layout";
  headers: string[][];
  rows: string[][];
  rawHtml?: string | undefined;
}
```

Both table types are normalized into the same structure: `headers` contains header rows (each an array of cell strings), `rows` contains body rows. The renderer produces Markdown pipe-table syntax. Tables with `colspan` or `rowspan` that cannot be flattened into simple rows are stored in `rawHtml` and rendered with a comment indicating the table could not be simplified.

### TOCNode and TOCItemNode

Represents a table of contents block and its entries.

```typescript
interface TOCNode extends BaseNode {
  readonly type: "toc";
  items: TOCItemNode[];
}

interface TOCItemNode extends BaseNode {
  readonly type: "tocItem";
  number?: string | undefined;
  title?: string | undefined;
  href?: string | undefined;
}
```

TOC nodes are present in the AST but skipped during Markdown rendering. They exist in the tree for potential future use (e.g., generating navigation structures).

### NotesContainerNode

Wraps a `<notes type="uscNote">` element, which groups related notes that follow a section's source credit.

```typescript
interface NotesContainerNode extends BaseNode {
  readonly type: "notesContainer";
  notesType?: string | undefined;
  children: (NoteNode | ASTNode)[];
}
```

Within a notes container, `NoteNode` children with `role: "crossHeading"` act as section dividers. Notes following a cross-heading belong to that category until the next cross-heading. The renderer uses these markers to apply the `NotesFilter`.

### QuotedContentNode

Represents quoted legal text, typically from bills or statutes quoted within notes.

```typescript
interface QuotedContentNode extends BaseNode {
  readonly type: "quotedContent";
  origin?: string | undefined;
  children: ASTNode[];
}
```

Rendered as a Markdown blockquote. Importantly, any `<section>` elements nested inside quoted content are suppressed during emission -- they are rendered inline within the blockquote rather than being emitted as standalone section files. The AST builder tracks this with a `quotedContentDepth` counter.

## The Complete Union Type

All node types compose into a single discriminated union:

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

The renderer dispatches on `node.type` to select the appropriate rendering function. TypeScript's discriminated union narrowing ensures exhaustive handling.

## Context Types

Two context types accompany emitted AST nodes:

```typescript
interface EmitContext {
  ancestors: AncestorInfo[];
  documentMeta: DocumentMeta;
}

interface AncestorInfo {
  levelType: LevelType;
  numValue?: string | undefined;
  heading?: string | undefined;
  identifier?: string | undefined;
}
```

`EmitContext` provides the ancestor chain (e.g., title > chapter > subchapter) and document-level metadata (title number, release point, positive-law status). Source packages use this context to determine output paths, populate frontmatter fields, and resolve cross-references. The ancestor chain is a lightweight summary -- it does not contain the full AST of parent levels, only enough to reconstruct hierarchy information.

`DocumentMeta` captures metadata extracted from the XML `<meta>` block: document title, type, number, release point, positive-law status, and publication timestamps. It is held in memory for the full duration of parsing and passed with every emitted node.
