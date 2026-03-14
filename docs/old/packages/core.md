# @lexbuild/core

`@lexbuild/core` is the format-agnostic foundation of the LexBuild platform. It provides streaming XML parsing, a typed AST (Abstract Syntax Tree) for representing legislative document structure, a stateless Markdown renderer, YAML frontmatter generation, and cross-reference link resolution. Every source-specific package -- `@lexbuild/usc` today, and future packages like `@lexbuild/cfr` -- depends on core for these shared primitives. Core itself knows nothing about U.S. Code semantics; it operates purely on XML structure, AST node types, and Markdown output conventions.

## Module Map

```
packages/core/src/
  index.ts                     # Barrel exports for the public API
  xml/
    namespace.ts               # USLM/XHTML namespace constants, element classification sets
    parser.ts                  # Streaming SAX parser wrapping saxes (~187 lines)
  ast/
    types.ts                   # AST node type definitions, level hierarchy constants (~323 lines)
    builder.ts                 # XML SAX events -> AST conversion, stack-based state machine (~1,180 lines)
  markdown/
    renderer.ts                # AST -> Markdown conversion, notes filtering (~585 lines)
    frontmatter.ts             # YAML frontmatter generation, FORMAT_VERSION, GENERATOR (~103 lines)
    links.ts                   # Cross-reference link resolution, OLRC fallback URLs (~111 lines)
```

## Data Flow

The core pipeline is a three-stage transformation:

```
USLM XML -> [XMLParser] -> SAX events -> [ASTBuilder] -> AST nodes -> [renderer] -> Markdown + YAML frontmatter
```

The pipeline is streaming: SAX events feed the ASTBuilder, which emits completed subtrees (sections, chapters, or entire titles) via a callback. Emitted nodes are immediately released to keep memory bounded for large titles (100MB+ XML for Titles 26 and 42).

For a detailed walkthrough of how these stages compose in the full conversion pipeline, see [Conversion Pipeline](../architecture/conversion-pipeline.md).

---

## XML Parser

**File**: `packages/core/src/xml/parser.ts`

The `XMLParser` class wraps the `saxes` library with a typed event emitter interface and namespace normalization. It transforms raw namespace-prefixed XML into normalized element names that downstream consumers can match without namespace awareness.

### ParserEvents Interface

```typescript
interface ParserEvents {
  openElement: (name: string, attrs: Attributes, ns: string) => void;
  closeElement: (name: string, ns: string) => void;
  text: (content: string) => void;
  error: (err: Error) => void;
  end: () => void;
}
```

Each event carries the normalized element name and, for `openElement`, a flat `Attributes` record (`Record<string, string>`) with namespace prefixes stripped from attribute names. The raw namespace URI is also passed for cases where handlers need to distinguish between namespaces directly.

### XMLParserOptions

```typescript
interface XMLParserOptions {
  defaultNamespace?: string;
  namespacePrefixes?: Readonly<Record<string, string>>;
}
```

- `defaultNamespace` -- the namespace URI whose elements emit bare names (defaults to `USLM_NS`).
- `namespacePrefixes` -- additional prefix mappings beyond the built-in ones. Merged with `NAMESPACE_PREFIXES` from `namespace.ts`.

### Namespace Normalization

The parser normalizes element names according to these rules:

| Namespace | Example XML | Normalized Name |
|---|---|---|
| USLM (default) | `<section xmlns="...uslm/1.0">` | `section` |
| XHTML | `<table xmlns="...xhtml">` | `xhtml:table` |
| Dublin Core | `<dc:title>` | `dc:title` |
| Unknown | `<foo xmlns="http://example.com">` | `{http://example.com}foo` |

This normalization is what makes the ASTBuilder's element dispatch table work with simple string keys rather than namespace-aware matching.

### Parsing Modes

The parser supports two modes:

- **`parseString(xml: string): void`** -- parses a complete XML string synchronously. Used primarily in tests.
- **`parseStream(stream: Readable): Promise<void>`** -- parses from a Node.js readable stream (typically `fs.createReadStream`). Returns a promise that resolves when parsing completes. This is the mode used in production for streaming large XML files.

---

## Namespace Classification

**File**: `packages/core/src/xml/namespace.ts`

This module defines namespace URI constants and element classification sets. These sets are the authoritative list of USLM element types that the ASTBuilder recognizes.

### Namespace Constants

```typescript
const USLM_NS = "http://xml.house.gov/schemas/uslm/1.0";
const XHTML_NS = "http://www.w3.org/1999/xhtml";
const DC_NS = "http://purl.org/dc/elements/1.1/";
const DCTERMS_NS = "http://purl.org/dc/terms/";
const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
```

### Element Classification Sets

| Set | Count | Elements |
|---|---|---|
| `LEVEL_ELEMENTS` | 26 | title, subtitle, chapter, subchapter, article, subarticle, part, subpart, division, subdivision, preliminary, section, subsection, paragraph, subparagraph, clause, subclause, item, subitem, subsubitem, appendix, compiledAct, reorganizationPlans, reorganizationPlan, courtRules, courtRule |
| `CONTENT_ELEMENTS` | 4 | content, chapeau, continuation, proviso |
| `INLINE_ELEMENTS` | 11 | b, i, sub, sup, ref, date, term, inline, shortTitle, del, ins |
| `NOTE_ELEMENTS` | 6 | note, notes, sourceCredit, statutoryNote, editorialNote, changeNote |
| `APPENDIX_LEVEL_ELEMENTS` | 5 | compiledAct, courtRules, courtRule, reorganizationPlans, reorganizationPlan |
| `META_ELEMENTS` | 5 | meta, docNumber, docPublicationName, docReleasePoint, property |
| `CONTAINER_ELEMENTS` | 9 | uscDoc, main, meta, toc, layout, header, row, column, tocItem |

These sets are used by the ASTBuilder to classify incoming elements and route them to the correct handler logic.

---

## AST Types

**File**: `packages/core/src/ast/types.ts`

The AST is a semantic representation of parsed USLM XML. It is NOT a 1:1 mapping of the XML document tree; it has been partially interpreted to simplify rendering and downstream consumption.

### Node Types

| Node Type | Interface | Purpose |
|---|---|---|
| Level | `LevelNode` | Hierarchical container: title, chapter, section, subsection, ..., subsubitem |
| Content | `ContentNode` | Text block with a variant: `content`, `chapeau`, `continuation`, or `proviso` |
| Inline | `InlineNode` | Inline text or formatting: text, bold, italic, ref, date, term, quoted, sup, sub, footnoteRef |
| Note | `NoteNode` | Editorial, statutory, or amendment note with topic and role |
| Source Credit | `SourceCreditNode` | Enactment source citation |
| Table | `TableNode` | XHTML or USLM layout table (variant flag distinguishes) |
| TOC | `TOCNode` | Table of contents (skipped in Markdown output) |
| TOC Item | `TOCItemNode` | Individual TOC entry |
| Notes Container | `NotesContainerNode` | Wraps `<notes type="uscNote">` blocks |
| Quoted Content | `QuotedContentNode` | Quoted legal text, rendered as blockquote |

The union type `ASTNode` encompasses all node types:

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

### Level Hierarchy

The `LEVEL_TYPES` constant defines the complete hierarchy from big to small:

```typescript
const LEVEL_TYPES = [
  // Big levels (17 types above section)
  "title", "appendix", "subtitle", "chapter", "subchapter",
  "compiledAct", "reorganizationPlans", "reorganizationPlan",
  "courtRules", "courtRule", "article", "subarticle",
  "part", "subpart", "division", "subdivision", "preliminary",
  // Primary level
  "section",
  // Small levels (8 types below section)
  "subsection", "paragraph", "subparagraph", "clause",
  "subclause", "item", "subitem", "subsubitem",
] as const;
```

`BIG_LEVELS` and `SMALL_LEVELS` are exported as `Set<LevelType>` for fast membership checks. The section level sits at the boundary -- it is neither big nor small but serves as the primary unit of legal citation.

### Key Interfaces

**LevelNode** -- the workhorse of the AST:

```typescript
interface LevelNode extends BaseNode {
  readonly type: "level";
  levelType: LevelType;
  num?: string;         // Display text: "Section 1.", "(a)", "CHAPTER 1--"
  numValue?: string;    // Normalized value: "1", "a"
  heading?: string;     // "Words denoting number, gender, and so forth"
  status?: string;      // "repealed", "transferred", "reserved", etc.
  children: ASTNode[];
}
```

**ContentNode** -- a block of text with inline children:

```typescript
interface ContentNode extends BaseNode {
  readonly type: "content";
  variant: "content" | "chapeau" | "continuation" | "proviso";
  children: InlineNode[];
}
```

**InlineNode** -- inline text and formatting:

```typescript
interface InlineNode extends BaseNode {
  readonly type: "inline";
  inlineType: InlineType;  // "text" | "bold" | "italic" | "ref" | "date" | "term" | "quoted" | "sup" | "sub" | "footnoteRef"
  text?: string;
  href?: string;           // For ref nodes: USLM identifier URI
  idref?: string;          // For footnoteRef nodes: footnote target ID
  children?: InlineNode[];
}
```

### Context Types

**EmitContext** -- provided when the ASTBuilder emits a completed subtree:

```typescript
interface EmitContext {
  ancestors: AncestorInfo[];    // Ancestor chain from document root to the emitted node's parent
  documentMeta: DocumentMeta;   // Metadata from the <meta> block
}
```

**AncestorInfo** -- a lightweight snapshot of each ancestor level:

```typescript
interface AncestorInfo {
  levelType: LevelType;
  numValue?: string;
  heading?: string;
  identifier?: string;
}
```

**DocumentMeta** -- document-level metadata extracted from `<meta>`:

```typescript
interface DocumentMeta {
  dcTitle?: string;              // dc:title
  dcType?: string;               // dc:type (e.g., "USCTitle")
  docNumber?: string;            // docNumber (e.g., "1", "5a" for appendix)
  docPublicationName?: string;   // Publication name with release point
  releasePoint?: string;         // Release point identifier
  positivelaw?: boolean;         // Whether this is positive law
  publisher?: string;            // dc:publisher
  created?: string;              // dcterms:created (ISO timestamp)
  creator?: string;              // dc:creator
  identifier?: string;           // Root document identifier
}
```

For a visual representation of how these types relate, see [AST Model](../architecture/ast-model.md).

---

## AST Builder

**File**: `packages/core/src/ast/builder.ts`

The `ASTBuilder` class is the core state machine that transforms SAX events into the typed AST. At approximately 1,180 lines, it is the largest module in the codebase. It consumes `openElement`, `closeElement`, and `text` events from the XML parser and constructs AST nodes on a stack.

### ASTBuilderOptions

```typescript
interface ASTBuilderOptions {
  emitAt: LevelType;
  onEmit: (node: LevelNode, context: EmitContext) => void | Promise<void>;
}
```

- `emitAt` -- the level at which completed subtrees are emitted. Set to `"section"` for section-level granularity, `"chapter"` for chapter-level, or `"title"` for title-level. When the closing tag of an element at this level is processed, the `onEmit` callback fires.
- `onEmit` -- callback receiving the completed `LevelNode` and its `EmitContext`. The callback may return a promise, but during SAX processing the return value is not awaited (the collect-then-write pattern handles this).

### Stack-Based Construction

The builder maintains a stack of `StackFrame` objects, each representing an in-progress element. Frames track:

- **Kind**: `level`, `content`, `inline`, `note`, `ignore`, etc.
- **AST node**: the node being constructed
- **Text buffer**: accumulates text content

On element open, a new frame is pushed. On element close, the frame pops and its completed node is appended to the parent frame's children. When the popped frame matches the `emitAt` level, the node is emitted via the callback and released from memory.

### Collector Zones

Two specialized state machines handle complex table-building:

- **XHTML table collector**: activates when `xhtml:table` is opened. Accumulates `xhtml:tr`, `xhtml:th`, `xhtml:td` events into `headers[][]` and `rows[][]` arrays on a `TableNode`.
- **USLM layout collector**: activates when `layout` is opened. Processes `header`, `row`, and `column` elements using leader separators.

These collectors are checked before normal element handlers, keeping table-building logic isolated from the main stack processing.

### Text Bubbling

Text inside nested inline elements bubbles up to the nearest content-collecting frame. For example, text within `<heading><b>Editorial Notes</b></heading>` accumulates in the heading frame's text buffer via `bubbleTextToCollector()`, producing a unified heading string.

### Implementation Details

- **`<p>` elements**: absorbed into their parent content node's inline children (no separate AST node). Multiple `<p>` elements inject `"\n\n"` separators via `handlePClose()`.
- **`<num>` dual data**: the `@value` attribute (normalized) is set in `onOpenElement`; the display text is set via `onText`. Both are stored on the parent `LevelNode`.
- **`quotedContentDepth`**: a counter that suppresses section emission inside `<quotedContent>` blocks. Quoted bills in statutory notes may contain `<section>` elements that should not produce output files.
- **Inline type mapping**: `"b"` maps to `"bold"`, `"i"` to `"italic"`, `"ref"` to `"ref"`. Elements like `"inline"`, `"shortTitle"`, `"del"`, `"ins"` map to `"text"` (pass-through).
- **Footnote refs**: `<ref class="footnoteRef" idref="fn1">` produces an `InlineNode` with `inlineType: "footnoteRef"`, rendered as `[^fn1]`.

---

## Markdown Renderer

**File**: `packages/core/src/markdown/renderer.ts`

The renderer converts AST nodes to Markdown strings. It is stateless and pure -- no side effects, no file I/O. The same AST can be rendered multiple times with different options.

### Rendering Functions

```typescript
function renderDocument(sectionNode: LevelNode, frontmatter: FrontmatterData, options: RenderOptions): string;
function renderSection(node: LevelNode, options: RenderOptions): string;
function renderNode(node: ASTNode, options: RenderOptions): string;
```

- **`renderDocument()`** -- produces a complete Markdown file: YAML frontmatter block + rendered section body + trailing newline.
- **`renderSection()`** -- renders a section-level `LevelNode` with its heading and children. The heading level is `1 + headingOffset`.
- **`renderNode()`** -- dispatches to the appropriate renderer based on node type. This is the main recursive entry point for rendering child nodes.

### RenderOptions

```typescript
interface RenderOptions {
  headingOffset: number;                              // 0 = section is H1, 1 = section is H2
  linkStyle: "relative" | "canonical" | "plaintext";  // How to render cross-references
  resolveLink?: (identifier: string) => string | null; // Resolver for "relative" link style
  notesFilter?: NotesFilter;                           // undefined = include all notes
}
```

### NotesFilter

```typescript
interface NotesFilter {
  editorial: boolean;    // Include editorial notes (codification, dispositionOfSections)
  statutory: boolean;    // Include statutory notes (changeOfName, regulations, miscellaneous, repeals)
  amendments: boolean;   // Include amendment history (amendments, effectiveDateOfAmendment)
}
```

Cross-heading notes (`<note role="crossHeading">`) act as category markers inside `<notes>` containers. Notes following a cross-heading with `topic="editorialNotes"` are editorial; those following `topic="statutoryNotes"` are statutory. Individual note topics can also be classified directly: `"codification"` and `"dispositionOfSections"` are always editorial; `"changeOfName"`, `"regulations"`, `"miscellaneous"`, `"repeals"`, and others are always statutory.

When `notesFilter` is `undefined` (the default), all notes are included. When set, the filter selectively includes or excludes notes without modifying the AST.

### Rendering Conventions

| AST Node | Markdown Output |
|---|---|
| Section heading | `# Section 1. Words denoting...` |
| Small levels (subsection-subsubitem) | `**(a)** **Heading.** Content text...` (bold inline numbering, not headings) |
| Big levels within sections | `**SUBPART A Title**` (bold text, not headings) |
| Content blocks | Plain text paragraphs |
| Bold / italic / term | `**text**` / `*text*` / `**term**` |
| Cross-references | Plain text, `[text](url)`, or relative links depending on `linkStyle` |
| Footnote references | `[^fn1]` |
| Source credits | `---` horizontal rule + `**Source Credit**: (text)` |
| Notes with headings | Cross-headings as `## Heading`, note headings as `### Heading` |
| Tables | Markdown pipe tables; complex tables (colspan/rowspan) skipped with comment |
| Quoted content | Blockquoted text (`> ` prefix per line) |
| TOC nodes | Skipped (empty string) |
| Superscript / subscript | `<sup>text</sup>` / `<sub>text</sub>` |

### Heading Cap

Big-level headings beyond H5 render as bold text rather than Markdown headings. H6 is reserved for sections within deeply nested hierarchies. This prevents heading level overflow in title-level output where the hierarchy can be 6+ levels deep.

---

## Frontmatter Generator

**File**: `packages/core/src/markdown/frontmatter.ts`

### FrontmatterData Interface

```typescript
interface FrontmatterData {
  identifier: string;                // "/us/usc/t1/s1"
  title: string;                     // "1 USC Section 1 - Words denoting..."
  title_number: number;
  title_name: string;
  section_number?: string;           // String, can be alphanumeric ("7801", "202a")
  section_name?: string;
  chapter_number?: number;
  chapter_name?: string;
  subchapter_number?: string;
  subchapter_name?: string;
  part_number?: string;
  part_name?: string;
  positive_law: boolean;
  source_credit?: string;
  currency: string;                  // Release point identifier
  last_updated: string;              // ISO date
  status?: string;                   // "repealed", "transferred", etc.
  chapter_count?: number;            // Title-level granularity only
  section_count?: number;            // Title-level granularity only
  total_token_estimate?: number;     // Title-level granularity only
}
```

### generateFrontmatter()

```typescript
function generateFrontmatter(data: FrontmatterData): string;
```

Produces a complete YAML frontmatter block including `---` delimiters. Field order is controlled manually to ensure consistent output. The `yaml` package is used with `lineWidth: 0` (no wrapping) and `defaultStringType: "QUOTE_DOUBLE"`.

Optional fields (section_number, chapter_number, source_credit, status, chapter_count, section_count, total_token_estimate) are only included when their values are defined. This makes title-level output omit section/chapter fields, and section-level output omit aggregate count fields.

### Constants

```typescript
const FORMAT_VERSION = "1.0.0";
const GENERATOR = `lexbuild@${version}`;  // version read from package.json at module load
```

These constants are included in every frontmatter block and in `_meta.json` sidecar files. They enable consumers to detect format changes and track which version of LexBuild produced a given output.

---

## Link Resolver

**File**: `packages/core/src/markdown/links.ts`

The link resolver handles cross-reference resolution for USLM identifier URIs. It maintains a registry of converted files and provides fallback URLs for unresolved references.

### LinkResolver Interface

```typescript
interface LinkResolver {
  resolve(identifier: string, fromFile: string): string | null;
  register(identifier: string, filePath: string): void;
  fallbackUrl(identifier: string): string | null;
}
```

### createLinkResolver()

```typescript
function createLinkResolver(): LinkResolver;
```

Creates a new resolver instance backed by an internal `Map<string, string>` registry.

### Resolution Flow

1. **Exact match**: look up the identifier in the registry. If found, compute a relative path from `fromFile` to the target using `path.relative()`.
2. **Section-level fallback**: if the identifier includes a subsection path (e.g., `/us/usc/t1/s1/a/2`), strip the subsection and try the section-level identifier (`/us/usc/t1/s1`).
3. **Not found**: return `null`. The renderer will then use `fallbackUrl()` for USC references or render as plain text for non-USC references.

### parseIdentifier()

```typescript
function parseIdentifier(identifier: string): ParsedIdentifier | null;

interface ParsedIdentifier {
  jurisdiction: string;   // "us"
  code: string;           // "usc"
  titleNum?: string;      // "1", "26"
  sectionNum?: string;    // "1", "7801", "106a"
  subPath?: string;       // "a/2"
}
```

Parses identifiers matching the pattern `/us/usc/t{N}[/s{N}[/{sub}]]`. Returns `null` for non-USC identifiers (stat, pl, act references), which are always rendered as plain text.

### Fallback URLs

For USC references not found in the registry, the resolver builds OLRC website URLs:

```
https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title{N}-section{N}
```

Non-USC references (`/us/stat/...`, `/us/pl/...`) always render as plain text -- no link is generated.

### Registration Flow

Registration happens during the write phase of conversion. As each section is written to disk, its identifier and file path are registered with the resolver. This means:

- Cross-references within the same title always resolve (written in the same conversion run).
- Cross-references to other titles resolve only if those titles are also converted in the same session.
- All unresolvable references fall back to OLRC website URLs.

---

## Relationship to Source Packages

Core is intentionally source-agnostic. The `ASTBuilder` class does embed USLM element handling directly (it is not a generic XML-to-AST mapper), but the AST types, rendering pipeline, frontmatter generation, and link resolution are designed to work with any legislative XML source that can be mapped to the same AST node types.

When adding a new source package (e.g., `@lexbuild/cfr`), the expected approach is:

1. Extend or create a custom builder that produces the same AST node types.
2. Reuse `renderDocument()`, `generateFrontmatter()`, and `createLinkResolver()` unchanged.
3. Add source-specific logic only in the new package.

See [Conversion Pipeline](../architecture/conversion-pipeline.md) for how core's modules are composed by `@lexbuild/usc`.
