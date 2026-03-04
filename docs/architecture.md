# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          lexbuild CLI                                 │
│  ┌──────────┐   ┌──────────┐                                      │
│  │ download  │   │ convert  │                                      │
│  └────┬─────┘   └────┬─────┘                                      │
│       │               │                                             │
│       ▼               ▼                                             │
│  ┌─────────┐   ┌─────────────────────────┐                         │
│  │  OLRC   │   │    Conversion Pipeline  │                         │
│  │ Client  │   │                         │                         │
│  └─────────┘   │  Parse → Build AST →    │                         │
│  (@lexbuild/usc) │  Render → Write         │                         │
│                │                         │                         │
│                └──────────┬──────────────┘                         │
│                           │                                        │
│       ┌───────────────────┼──────────────────────┐                 │
│       ▼                   ▼                      ▼                 │
│  ┌─────────┐     ┌──────────────┐     ┌──────────────────┐        │
│  │   XML   │     │     AST      │     │    Markdown      │        │
│  │  Parser │     │   Builder    │     │    Renderer      │        │
│  │ (SAX)   │     │ (section     │     │  + Frontmatter   │        │
│  │         │     │  emit)       │     │  + Link Resolver │        │
│  └─────────┘     └──────────────┘     └──────────────────┘        │
│  (@lexbuild/core)  (@lexbuild/core)       (@lexbuild/core)              │
└─────────────────────────────────────────────────────────────────────┘
```

## Package Dependency Graph

```
lexbuild (CLI)
  ├── @lexbuild/usc
  │     └── @lexbuild/core
  └── @lexbuild/core (direct dep for shared types)
```

The CLI depends on both `usc` and `core`. The `usc` package depends on `core`. `core` has no internal dependencies — only external deps (`saxes`, `yaml`, `zod`).

---

## @lexbuild/core

The core package provides format-agnostic infrastructure. It knows nothing about U.S. Code-specific semantics — only about XML parsing, AST construction, Markdown rendering, and metadata generation.

### XML Parser (`src/xml/parser.ts`)

The `XMLParser` class wraps `saxes` with a typed event emitter interface and namespace normalization.

```typescript
interface ParserEvents {
  openElement: (name: string, attrs: Attributes, ns: string) => void;
  closeElement: (name: string, ns: string) => void;
  text: (content: string) => void;
  error: (err: Error) => void;
  end: () => void;
}

interface XMLParserOptions {
  defaultNamespace?: string;       // NS URI for bare element names (default: USLM_NS)
  namespacePrefixes?: Record<string, string>;  // Additional prefix mappings
}
```

The parser normalizes element names: elements in the default namespace emit bare names (e.g., `section`), elements in other namespaces emit prefixed names (e.g., `xhtml:table`). Supports both `parseString()` for complete XML and `parseStream()` for streaming from a `Readable`.

### AST Types (`src/ast/types.ts`)

The intermediate AST is a tree of typed nodes. It is NOT a 1:1 mapping of the XML — it is a semantic representation that has been partially interpreted.

```typescript
interface LevelNode {
  type: "level";
  levelType: LevelType;       // "title" | "chapter" | "section" | "subsection" | ...
  num?: string;                // Display text: "§ 1."
  numValue?: string;           // Normalized value: "1"
  heading?: string;            // "Words denoting number, gender, and so forth"
  status?: string;             // "repealed", "transferred", etc.
  children: ASTNode[];
}

interface ContentNode {
  type: "content";
  variant: "content" | "chapeau" | "continuation" | "proviso";
  children: InlineNode[];
}

interface InlineNode {
  type: "inline";
  inlineType: InlineType;      // "text" | "bold" | "italic" | "ref" | "date" | ...
  text?: string;
  href?: string;               // For ref nodes
  idref?: string;              // For footnoteRef nodes
  children?: InlineNode[];
}

interface NoteNode {
  type: "note";
  topic?: string;              // "amendments", "codification", etc.
  role?: string;               // "crossHeading"
  noteType?: string;           // "uscNote", "footnote"
  heading?: string;
  children: ASTNode[];
}

interface SourceCreditNode { type: "sourceCredit"; children: InlineNode[]; }
interface TableNode         { type: "table"; variant: "xhtml" | "layout"; headers: string[][]; rows: string[][]; rawHtml?: string; }
interface TOCNode           { type: "toc"; items: TOCItemNode[]; }
interface NotesContainerNode { type: "notesContainer"; notesType?: string; children: ASTNode[]; }
interface QuotedContentNode  { type: "quotedContent"; origin?: string; children: ASTNode[]; }

type ASTNode = LevelNode | ContentNode | InlineNode | NoteNode | SourceCreditNode
             | TableNode | TOCNode | TOCItemNode | NotesContainerNode | QuotedContentNode;
```

### AST Builder (`src/ast/builder.ts`)

The `ASTBuilder` class consumes parser events and maintains a stack of open nodes. It implements the **section-emit pattern**: when a `<section>` close tag is encountered, the completed `LevelNode` is emitted via callback, and its subtree is released from memory.

```typescript
interface ASTBuilderOptions {
  emitAt: LevelType;
  onEmit: (node: LevelNode, context: EmitContext) => void | Promise<void>;
}

interface EmitContext {
  ancestors: AncestorInfo[];     // Ancestor chain: title > chapter > ...
  documentMeta: DocumentMeta;    // Metadata from <meta> block
}
```

This is the critical memory-management mechanism. For section-level granularity, `emitAt: "section"` means only one section's AST is in memory at a time.

Element handling is built into the `ASTBuilder` — it maps XML element names to AST node types internally using a static lookup table. There is no pluggable handler registry; USLM element semantics are encoded directly in the builder.

### Markdown Renderer (`src/markdown/renderer.ts`)

Converts AST nodes to Markdown strings. Stateless and pure — no side effects.

```typescript
interface NotesFilter {
  editorial: boolean;    // Include editorial notes
  statutory: boolean;    // Include statutory notes
  amendments: boolean;   // Include amendment history
}

interface RenderOptions {
  headingOffset: number;
  linkStyle: "relative" | "canonical" | "plaintext";
  resolveLink?: (identifier: string) => string | null;
  notesFilter?: NotesFilter;
}

function renderDocument(sectionNode: LevelNode, frontmatter: FrontmatterData, options: RenderOptions): string;
function renderSection(sectionNode: LevelNode, options: RenderOptions): string;
function renderNode(node: ASTNode, options: RenderOptions): string;
```

### Link Resolver (`src/markdown/links.ts`)

Resolves USLM identifier URIs to relative Markdown file paths.

```typescript
interface LinkResolver {
  resolve(identifier: string, fromFile: string): string | null;
  register(identifier: string, filePath: string): void;
  fallbackUrl(identifier: string): string | null;
}

function createLinkResolver(): LinkResolver;
function parseIdentifier(identifier: string): ParsedIdentifier | null;
```

The link resolver uses single-pass registration:

1. As sections are written, their identifiers are registered with `register()`
2. Cross-references within the same title always resolve (same conversion run)
3. Cross-references to other titles resolve only if those titles have been converted
4. Unresolvable references fall back to OLRC website URLs via `fallbackUrl()`

### Frontmatter Generator (`src/markdown/frontmatter.ts`)

```typescript
interface FrontmatterData {
  identifier: string;          // "/us/usc/t1/s1"
  title: string;               // "1 USC § 1 - Words denoting..."
  title_number: number;
  title_name: string;
  section_number: string;      // String — can be alphanumeric
  section_name: string;
  chapter_number?: number;
  chapter_name?: string;
  subchapter_number?: string;
  subchapter_name?: string;
  part_number?: string;
  part_name?: string;
  positive_law: boolean;
  source_credit?: string;
  currency: string;            // Release point identifier
  last_updated: string;        // ISO date from XML metadata
  status?: string;             // "repealed", "transferred", etc.
}

function generateFrontmatter(data: FrontmatterData): string;
```

Also exports `FORMAT_VERSION` (`"1.0.0"`) and `GENERATOR` (`"lexbuild@{version}"`).

---

## @lexbuild/usc

The USC package implements U.S. Code-specific conversion logic.

### Converter (`src/converter.ts`)

Orchestrates the full pipeline for a single XML file:

```typescript
interface ConvertOptions {
  input: string;                   // Path to XML file
  output: string;                  // Output directory root
  granularity: "section" | "chapter";
  linkStyle: "relative" | "canonical" | "plaintext";
  includeSourceCredits: boolean;
  includeNotes: boolean;           // True = all notes
  includeEditorialNotes: boolean;  // Selective (when includeNotes is false)
  includeStatutoryNotes: boolean;
  includeAmendments: boolean;
  dryRun: boolean;
}

interface ConvertResult {
  sectionsWritten: number;
  files: string[];
  titleNumber: string;
  titleName: string;
  dryRun: boolean;
  chapterCount: number;
  totalTokenEstimate: number;
  peakMemoryBytes: number;
}

async function convertTitle(options: ConvertOptions): Promise<ConvertResult>;
```

The converter:

1. Creates a `ReadStream` for the XML file
2. Pipes it through the SAX parser
3. Extracts document metadata from `<meta>`
4. Configures the AST builder with `emitAt: "section"`
5. For each emitted section, renders to Markdown with frontmatter and writes to disk
6. Generates `_meta.json` index files after all sections are written
7. Generates `README.md` overview files for title directories

### Downloader (`src/downloader.ts`)

```typescript
interface DownloadOptions {
  outputDir: string;
  titles?: number[];       // Specific titles, or undefined for all
  releasePoint?: string;   // e.g., "119-73not60", or undefined for current
}

async function downloadTitles(options: DownloadOptions): Promise<DownloadResult>;
```

The downloader fetches zip files from OLRC, extracts the XML, and writes to the output directory. The current release point is hardcoded as `CURRENT_RELEASE_POINT` with a `--release-point` CLI override.

---

## Data Flow: Section-Level Conversion

```
usc01.xml
    │
    ▼
┌──────────────────────────┐
│ SAX Parser (streaming)   │
│ Events: open/close/text  │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ AST Builder              │
│ Stack-based construction │
│ Emits at section level   │──── <meta> ──→ DocumentMeta (held in memory)
└───────────┬──────────────┘
            │
            │ onEmit(sectionNode, context)
            ▼
┌──────────────────────────┐
│ Markdown Renderer        │
│ + Frontmatter Generator  │
│ AST → Markdown string    │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ File Writer              │
│ Write .md to output dir  │
│ Collect metadata for     │
│ _meta.json + README.md   │
└───────────┬──────────────┘
            │
            ▼
       output/usc/title-01/chapter-01/section-1.md
```

### Memory Profile

At any point during section-level conversion:

| Item | Memory |
|------|--------|
| SAX parser internal buffer | ~64KB |
| AST builder stack (ancestors only) | ~1KB per level x ~5 levels = ~5KB |
| Current section AST | Varies. Largest sections ~500KB (Title 26 long sections) |
| Document metadata | ~2KB |
| Link resolver registry | ~100 bytes x sections converted so far |
| File write buffer | ~64KB |
| **Worst case total** | **< 10MB per title** |

E2E verified: all 54 titles (58 files including appendices), 60,261 sections, ~25 seconds. Peak memory for the largest title (Title 42, 107MB XML) is ~661MB RSS.

---

## Cross-Reference Resolution

### Identifier Parsing

```
/us/usc/t1/s201/a/2
  │    │   │  │   │ └── paragraph "2"
  │    │   │  │   └──── subsection "a"
  │    │   │  └──────── section "201"
  │    │   └─────────── title "1"
  │    └─────────────── code "usc" (United States Code)
  └──────────────────── jurisdiction "us"
```

### Resolution Strategy

The link resolver uses single-pass registration during conversion:

- Cross-references within the same title always resolve (same conversion run)
- Cross-references to other titles resolve if those titles are also being converted
- All other cross-references fall back to OLRC website URLs

### Token Estimation

Token counts in `_meta.json` use a character/4 heuristic (`Math.ceil(contentLength / 4)`). This provides a reasonable approximation for RAG chunk planning without requiring a tokenizer dependency.
