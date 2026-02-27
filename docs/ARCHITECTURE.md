# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          law2md CLI                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                       │
│  │ download  │   │ convert  │   │  index   │                       │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                       │
│       │               │              │                              │
│       ▼               ▼              ▼                              │
│  ┌─────────┐   ┌─────────────────────────┐   ┌──────────────────┐  │
│  │  OLRC   │   │    Conversion Pipeline  │   │  Index Builder   │  │
│  │ Client  │   │                         │   │                  │  │
│  └─────────┘   │  Parse → Transform →    │   │  Walk output dir │  │
│  (@law2md/usc) │  Render → Write         │   │  Generate _meta  │  │
│                │                         │   │                  │  │
│                └──────────┬──────────────┘   └──────────────────┘  │
│                           │                                        │
│       ┌───────────────────┼──────────────────────┐                 │
│       ▼                   ▼                      ▼                 │
│  ┌─────────┐     ┌──────────────┐     ┌──────────────────┐        │
│  │   XML   │     │   Element    │     │    Markdown      │        │
│  │  Parser │     │   Handlers   │     │    Renderer      │        │
│  │ (SAX)   │     │ (USC-specific│     │  + Frontmatter   │        │
│  └─────────┘     └──────────────┘     └──────────────────┘        │
│  (@law2md/core)  (@law2md/usc)        (@law2md/core)              │
└─────────────────────────────────────────────────────────────────────┘
```

## Package Dependency Graph

```
law2md (CLI)
  ├── @law2md/usc
  │     └── @law2md/core
  └── @law2md/core (direct dep for shared types)
```

The CLI depends on both `usc` and `core`. The `usc` package depends on `core`. `core` has no internal dependencies — only external deps (`saxes`, `yaml`, `zod`).

---

## @law2md/core

The core package provides format-agnostic infrastructure. It knows nothing about U.S. Code-specific semantics — only about XML parsing, AST construction, Markdown rendering, and metadata generation.

### XML Parser (`src/xml/parser.ts`)

Wraps `saxes` with a typed event emitter interface.

```typescript
interface ParserEvents {
  openElement: (name: string, attrs: Record<string, string>, ns: string) => void;
  closeElement: (name: string, ns: string) => void;
  text: (content: string) => void;
  error: (err: Error) => void;
  end: () => void;
}

interface XMLParserOptions {
  /** Namespace URI to treat as default (elements in this NS emit unqualified names) */
  defaultNamespace: string;
  /** Additional namespace prefixes to recognize */
  namespaces?: Record<string, string>;
}
```

The parser normalizes element names: elements in the default namespace emit bare names (e.g., `section`), elements in other namespaces emit prefixed names (e.g., `xhtml:table`). This simplifies downstream handler dispatch.

### AST Types (`src/ast/types.ts`)

The intermediate AST is a tree of typed nodes. It is NOT a 1:1 mapping of the XML — it is a semantic representation that has been partially interpreted.

```typescript
/** Base node all AST nodes extend */
interface BaseNode {
  type: string;
  /** USLM identifier if present (e.g., "/us/usc/t1/s1") */
  identifier?: string;
  /** Source XML element name for debugging */
  sourceElement?: string;
}

/** A hierarchical level (title, chapter, section, subsection, etc.) */
interface LevelNode extends BaseNode {
  type: "level";
  levelType: LevelType; // "title" | "chapter" | "section" | "subsection" | ...
  num?: string;         // Display text: "§ 1."
  numValue?: string;    // Normalized value: "1"
  heading?: string;     // "Words denoting number, gender, and so forth"
  children: ASTNode[];
}

/** A block of text content */
interface ContentNode extends BaseNode {
  type: "content";
  variant: "content" | "chapeau" | "continuation" | "proviso";
  children: InlineNode[];
}

/** Inline text or formatting */
interface InlineNode extends BaseNode {
  type: "text" | "bold" | "italic" | "ref" | "date" | "term" | "quoted";
  text?: string;
  href?: string;        // For ref nodes
  children?: InlineNode[];
}

/** A note */
interface NoteNode extends BaseNode {
  type: "note";
  topic?: string;       // "amendments", "codification", etc.
  role?: string;        // "crossHeading", "editorialNotes", "statutoryNotes"
  heading?: string;
  children: ASTNode[];
}

/** Source credit */
interface SourceCreditNode extends BaseNode {
  type: "sourceCredit";
  text: string;
}

/** Table (either XHTML or layout-based) */
interface TableNode extends BaseNode {
  type: "table";
  variant: "xhtml" | "layout";
  headers: string[][];
  rows: string[][];
}

/** Table of contents */
interface TOCNode extends BaseNode {
  type: "toc";
  items: TOCItemNode[];
}

type ASTNode = LevelNode | ContentNode | NoteNode | SourceCreditNode |
               TableNode | TOCNode | InlineNode;
```

### AST Builder (`src/ast/builder.ts`)

The AST builder consumes parser events and maintains a stack of open nodes. It implements the **section-emit pattern**: when a `<section>` close tag is encountered, the completed `LevelNode` for that section is emitted via callback, and its subtree is released from memory.

```typescript
interface ASTBuilderOptions {
  /** Emit completed nodes at this level instead of accumulating */
  emitAt: LevelType;
  /** Callback when a completed node is ready */
  onEmit: (node: LevelNode, context: EmitContext) => void | Promise<void>;
}

interface EmitContext {
  /** Ancestor chain (title > chapter > ...) with identifiers and headings */
  ancestors: AncestorInfo[];
  /** Document-level metadata from <meta> block */
  documentMeta: DocumentMeta;
}
```

This is the critical memory-management mechanism. For section-level granularity, `emitAt: "section"` means only one section's AST is in memory at a time. For chapter-level, `emitAt: "chapter"`.

### Markdown Renderer (`src/markdown/renderer.ts`)

Converts AST nodes to Markdown strings. Stateless and pure — no side effects.

```typescript
interface RenderOptions {
  /** Heading level offset (e.g., 0 = section is H1, 1 = section is H2) */
  headingOffset: number;
  /** How to render cross-references */
  linkStyle: "relative" | "canonical" | "plaintext";
  /** Function to resolve a USLM identifier to a relative file path */
  resolveLink: (identifier: string) => string | null;
}

function renderNode(node: ASTNode, options: RenderOptions): string;
function renderDocument(nodes: ASTNode[], frontmatter: FrontmatterData, options: RenderOptions): string;
```

### Link Resolver (`src/markdown/links.ts`)

Resolves USLM identifier URIs to relative Markdown file paths.

```typescript
interface LinkResolver {
  /**
   * Given a USLM identifier (e.g., "/us/usc/t2/s285b") and the current
   * file's path in the output tree, return a relative markdown link path
   * or null if the target is not in the output corpus.
   */
  resolve(identifier: string, fromFile: string): string | null;

  /**
   * Register a converted file so future cross-references can resolve to it.
   */
  register(identifier: string, filePath: string): void;

  /**
   * Build the fallback URL for identifiers that can't be resolved locally.
   */
  fallbackUrl(identifier: string): string;
}
```

The link resolver requires two passes for perfect resolution (you need to know all output files before you can resolve cross-references). In practice, we handle this with:

1. **Optimistic resolution**: Parse the identifier to determine expected file path based on naming convention. If the target title is being converted in the same run, the path is deterministic.
2. **Fallback**: If the target title is not being converted, generate an OLRC website URL.
3. **Post-pass fixup** (optional, future): After all files are written, scan for unresolved links and attempt resolution against the `_meta.json` index.

### Frontmatter Generator (`src/markdown/frontmatter.ts`)

```typescript
interface FrontmatterData {
  identifier: string;
  title: string;           // Human-readable: "1 USC § 1 - Words denoting..."
  title_number: number;
  title_name: string;
  chapter_number?: number;
  chapter_name?: string;
  section_number?: string; // String because some are alphanumeric
  section_name?: string;
  positive_law: boolean;
  source_credit?: string;
  currency: string;        // Release point identifier
  last_updated: string;    // ISO date from XML metadata
}

function generateFrontmatter(data: FrontmatterData): string;
```

---

## @law2md/usc

The USC package implements U.S. Code-specific conversion logic.

### Converter (`src/converter.ts`)

Orchestrates the full pipeline for a single XML file:

```typescript
interface ConvertOptions {
  input: string;            // Path to XML file
  output: string;           // Output directory root
  granularity: "section" | "chapter";
  includeNotes: boolean;
  includeEditorialNotes: boolean;
  includeStatutoryNotes: boolean;
  includeAmendments: boolean;
  includeSourceCredits: boolean;
  includeTOC: boolean;
  linkStyle: "relative" | "canonical" | "plaintext";
  availableTitles: number[];
  concurrency: number;
}

async function convertTitle(options: ConvertOptions): Promise<ConvertResult>;
```

The converter:

1. Creates a `ReadStream` for the XML file
2. Pipes it through the SAX parser
3. Extracts document metadata from `<meta>`
4. Configures the AST builder with the appropriate emit level
5. For each emitted section/chapter, applies element handlers, renders to Markdown, writes to disk
6. Generates `_meta.json` files after all sections are written
7. Generates `README.md` files for title and chapter directories

### Element Handlers (`src/elements/`)

Each file exports handler functions for specific USLM elements. Handlers receive an AST node and a handler context, and return a Markdown string or modified AST node.

```typescript
interface HandlerContext {
  options: ConvertOptions;
  linkResolver: LinkResolver;
  ancestors: AncestorInfo[];
  documentMeta: DocumentMeta;
}

type ElementHandler = (node: ASTNode, context: HandlerContext) => string;
```

Handler registry pattern:

```typescript
const handlers: Record<string, ElementHandler> = {
  section: handleSection,
  subsection: handleSubsection,
  paragraph: handleParagraph,
  // ...
};
```

### Downloader (`src/downloader.ts`)

```typescript
interface DownloadOptions {
  outputDir: string;
  titles?: number[];       // Specific titles, or undefined for all
  releasePoint?: string;   // e.g., "119-43", or undefined for current
  format?: "xml" | "xhtml";
}

async function downloadTitles(options: DownloadOptions): Promise<DownloadResult>;
```

The downloader:

1. Resolves the current release point (if not specified) by fetching the download page
2. Constructs download URLs
3. Downloads zip files with progress reporting
4. Extracts XML files to the output directory
5. Returns a manifest of downloaded files

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
│ Element Handlers         │
│ section.ts, notes.ts,    │
│ table.ts, etc.           │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ Markdown Renderer        │
│ AST → Markdown string    │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ Frontmatter Generator    │
│ Prepend YAML frontmatter │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ File Writer              │
│ Write .md to output dir  │
│ Collect metadata for     │
│ _meta.json               │
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
| AST builder stack (ancestors only) | ~1KB per level × ~5 levels = ~5KB |
| Current section AST | Varies. Largest sections ~500KB (Title 26 long sections) |
| Document metadata | ~2KB |
| Link resolver registry | ~100 bytes × sections converted so far |
| File write buffer | ~64KB |
| **Worst case total** | **< 10MB per title** |

This is well within the 512MB target even for Title 26.

---

## Cross-Reference Resolution Strategy

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

### Path Resolution

Given identifier `/us/usc/t2/s285b` and current file at `output/usc/title-01/chapter-03/section-201.md`:

1. Parse identifier: title=2, section=285b
2. Determine expected output path: `output/usc/title-02/chapter-??/section-285b.md`
3. Chapter lookup: requires knowing which chapter section 285b is in
4. If title 2 is being converted in this run, the link resolver will have registered section 285b's actual path
5. Compute relative path: `../../title-02/chapter-09/section-285b.md`
6. Generate link: `[section 285b of Title 2](../../title-02/chapter-09/section-285b.md)`

If title 2 is NOT being converted:

```markdown
[2 USC § 285b](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title2-section285b)
```

### Two-Pass vs. Single-Pass

For MVP, use single-pass with optimistic resolution:

- Cross-references within the same title always resolve (same conversion run)
- Cross-references to other titles resolve if those titles are also being converted
- All other cross-references fall back to OLRC URLs

Future optimization: maintain a persistent link registry (JSON file) that accumulates across runs, enabling cross-title resolution even when converting one title at a time.

---

## Configuration Schema

```typescript
/** Validated with Zod at CLI parse time */
const ConvertOptionsSchema = z.object({
  input: z.string().min(1),
  output: z.string().default("./output"),
  granularity: z.enum(["section", "chapter"]).default("section"),
  sourceType: z.enum(["usc", "cfr"]).default("usc"),
  titles: z.array(z.number().int().min(1).max(54)).optional(),
  includeNotes: z.boolean().default(false),
  includeEditorialNotes: z.boolean().default(false),
  includeStatutoryNotes: z.boolean().default(false),
  includeAmendments: z.boolean().default(false),
  includeSourceCredits: z.boolean().default(true),
  includeTOC: z.boolean().default(true),
  linkStyle: z.enum(["relative", "canonical", "plaintext"]).default("relative"),
  availableTitles: z.array(z.number()).optional(),
  concurrency: z.number().int().min(1).max(16).default(4),
  dryRun: z.boolean().default(false),
  verbose: z.boolean().default(false),
  logFormat: z.enum(["pretty", "json"]).default("pretty"),
});
```

---

## Error Taxonomy

```typescript
class Law2mdError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "Law2mdError";
  }
}

class XMLParseError extends Law2mdError {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
    options?: { cause?: unknown }
  ) {
    super(`XML parse error at ${line}:${column}: ${message}`, options);
    this.name = "XMLParseError";
  }
}

class UnknownElementError extends Law2mdError {
  /** Logged as warning, does not halt conversion */
  constructor(
    public readonly elementName: string,
    public readonly identifier?: string
  ) {
    super(`Unknown element <${elementName}> at ${identifier ?? "unknown location"}`);
    this.name = "UnknownElementError";
  }
}

class DownloadError extends Law2mdError { /* ... */ }
class OutputWriteError extends Law2mdError { /* ... */ }
```

---

## Extension Points

### Adding a New Source Type

The architecture is designed so that adding CFR support (or state statutes) requires:

1. A new package (e.g., `@law2md/cfr`) that depends on `@law2md/core`
2. Source-specific element handlers (CFR uses USLM 2.x with different element names)
3. Source-specific downloader (CFR XML is on govinfo.gov, not uscode.house.gov)
4. A new `--source-type cfr` variant registered in the CLI
5. Reuse of all core infrastructure: SAX parser, AST builder, Markdown renderer, frontmatter, link resolver

### Adding a New Output Format

If a future consumer needs JSON or HTML instead of Markdown:

1. Implement a new renderer in `@law2md/core/src/renderers/`
2. The AST is format-agnostic — renderers are pure functions from AST → string
3. Add `--format` CLI option

### Adding Pre-Computed Embeddings

1. New package: `@law2md/embeddings`
2. Reads `_meta.json` to enumerate files
3. Chunks Markdown content using token-aware splitter
4. Calls embedding API (OpenAI, Cohere, local model)
5. Outputs `.jsonl` sidecar files with vectors
