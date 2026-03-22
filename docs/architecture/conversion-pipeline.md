# Conversion Pipeline

The pipeline transforms legislative XML into structured Markdown through four stages: SAX parsing, AST construction, Markdown rendering, and file writing. The pipeline is streaming by default -- for section and chapter/part granularity, only one emitted subtree is held in memory at a time.

## End-to-End Data Flow

```
                                    Source-Specific
input.xml ──> [1. SAX Parser] ──> [2. AST Builder] ──> [3. Renderer] ──> [4. File Writer] ──> output/
              XMLParser/saxes      ASTBuilder (USLM)    Markdown +        writeFile/mkdir      source/
              namespace            EcfrASTBuilder         Frontmatter +                         title-NN/
              normalization        (GPO/SGML)             Link Resolver                         .../section-N.md
```

Stage 1 is shared across all sources. Stage 2 is source-specific -- each XML format has its own builder that produces the same shared AST node types. Stage 3 (rendering) and Stage 4 (file writing) are source-agnostic; the renderer operates on the common AST, and file I/O uses the same resilient wrappers regardless of source.

## Stage 1: SAX Parsing

`XMLParser` (in `@lexbuild/core`) wraps the `saxes` library with namespace normalization and a typed event emitter. It exposes three events: `openElement`, `closeElement`, and `text`.

**Namespace normalization.** Elements in the default namespace (USLM for USC) emit bare names (`section`, `heading`). Elements in other recognized namespaces emit prefixed names (`xhtml:table`, `dc:title`). eCFR XML has no namespace declarations, so the parser is configured with an empty default namespace and all elements emit bare names directly.

**Two parsing modes:**

- `parseString(xml)` -- synchronous, used in tests
- `parseStream(stream)` -- production streaming via `fs.createReadStream`, returns a Promise that resolves when parsing completes

The parser does not buffer the entire document. It passes SAX events to the builder as chunks arrive from the stream, keeping memory independent of input file size.

```typescript
const parser = new XMLParser({ defaultNamespace: USLM_NS });
parser.on("openElement", (name, attrs, ns) => builder.onOpenElement(name, attrs));
parser.on("closeElement", (name, ns) => builder.onCloseElement(name));
parser.on("text", (text) => builder.onText(text));

const stream = createReadStream(inputPath, "utf-8");
await parser.parseStream(stream);
```

## Stage 2: AST Construction

Source-specific builders consume parser events and produce the shared [AST node types](./ast-model.md). Both builders implement the same interface (`onOpenElement`, `onCloseElement`, `onText`) and emit completed subtrees through the same `onEmit` callback mechanism.

### USLM Builder (USC)

`ASTBuilder` in `@lexbuild/core` handles U.S. Code XML (USLM 1.0 schema). It uses a stack-based state machine where each in-progress XML element pushes a `StackFrame` onto the stack.

**Element classification.** Incoming element names are checked against classification sets to determine handling:

| Set | Elements | Behavior |
|-----|----------|----------|
| `LEVEL_ELEMENTS` | `title`, `chapter`, `section`, `subsection`, ... | Push level frame, track ancestors |
| `CONTENT_ELEMENTS` | `content`, `chapeau`, `continuation`, `proviso` | Push content frame, collect inline children |
| `INLINE_ELEMENTS` | `b`, `i`, `ref`, `date`, `term`, `sup`, `sub`, ... | Push inline frame, map to `InlineType` |
| `NOTE_ELEMENTS` | `note`, `statutoryNote`, `editorialNote`, ... | Push note frame |

**Collector zones.** XHTML tables (`<xhtml:table>`) and USLM layout tables (`<layout>`) use dedicated collector state machines, checked before normal element handlers. When the parser enters a table or layout element, a `TableCollector` accumulates header rows, body rows, and cell text. On close, the collector produces a `TableNode` and attaches it to the parent frame. This isolation keeps table-building logic separate from the main stack.

**Text bubbling.** Text inside nested inline elements (e.g., `<heading><b>Editorial Notes</b></heading>`) is bubbled up to the nearest heading or num collector frame via `bubbleTextToCollector()`, ensuring the heading frame captures the full text content regardless of intermediate inline wrappers.

### eCFR Builder

`EcfrASTBuilder` in `@lexbuild/ecfr` handles GPO/SGML-derived XML. It follows the same stack-based, emit-at-level pattern as the USLM builder but dispatches on eCFR element names.

**DIV-based hierarchy.** eCFR uses numbered DIV elements (`DIV1` through `DIV9`) where the `TYPE` attribute determines semantic meaning:

| Element | TYPE | Maps to |
|---------|------|---------|
| `DIV1` | `TITLE` | `title` |
| `DIV3` | `CHAPTER` | `chapter` |
| `DIV5` | `PART` | `part` |
| `DIV8` | `SECTION` | `section` |

**Flat content model.** Unlike USLM's nested `<subsection>`/`<paragraph>`/`<clause>` hierarchy, eCFR sections contain flat `<P>` elements with numbering prefixes like `(a)`, `(1)`, `(i)`. The builder treats these as content blocks rather than nested levels.

**Emphasis mapping.** The `<E>` element uses a `T` attribute code to indicate formatting: `"01"` and `"03"` map to bold, `"02"` and `"04"` map to italic, `"51"`/`"52"` map to subscript.

Both builders produce the same AST types (`LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, etc.), so the rendering pipeline in Stage 3 works identically for both sources. See [AST Model](./ast-model.md) for the full node type reference.

## Stage 3: Markdown Rendering

The renderer (`@lexbuild/core`) is stateless and pure -- no side effects, no file I/O. It converts AST nodes to Markdown strings.

**Three entry points:**

| Function | Purpose |
|----------|---------|
| `renderDocument(node, frontmatter, options)` | Full document: YAML frontmatter + Markdown content |
| `renderSection(node, options)` | Section heading and body |
| `renderNode(node, options)` | Dispatch by node type (level, content, inline, note, table, ...) |

**`RenderOptions`** controls output behavior:

- `headingOffset` -- shifts heading levels (0 = section renders as H1)
- `linkStyle` -- `"relative"` (resolved paths), `"canonical"` (OLRC/eCFR URLs), or `"plaintext"` (text only)
- `resolveLink` -- function injected by the converter to resolve identifiers to relative file paths
- `notesFilter` -- selectively include/exclude editorial, statutory, and amendment notes

**Cross-reference resolution.** The `LinkResolver` interface (in `@lexbuild/core`) provides a register/resolve/fallback pattern. During the first pass of section-granularity conversion, all section identifiers are registered with their output file paths. During the second pass (rendering), `resolveLink` queries the registry and computes relative paths. Unresolvable USC identifiers fall back to `uscode.house.gov` URLs; unresolvable CFR identifiers fall back to `ecfr.gov` URLs. Non-USC/CFR references (Statutes at Large, Public Laws) render as plain text. See [Link Resolution](./link-resolution.md) for details.

**Frontmatter generation.** `generateFrontmatter()` produces ordered YAML with `---` delimiters. Every file includes a `source` discriminator (`"usc"` or `"ecfr"`) and `legal_status` field. Source-specific optional fields (e.g., `authority`, `cfr_part` for eCFR) are included when defined.

## Stage 4: File Writing

Source packages (`@lexbuild/usc`, `@lexbuild/ecfr`) handle file writing. Both use the collect-then-write pattern described below. After Markdown files are written, sidecar metadata (`_meta.json` per directory, `README.md` per title) is generated for section-level granularity.

**Resilient file I/O.** `@lexbuild/core` exports `writeFile` and `mkdir` wrappers that retry on `ENFILE`/`EMFILE` errors with exponential backoff (initial delay 50ms, max 5s, up to 10 retries). When the pipeline writes 60,000+ files in rapid succession, external processes (Spotlight, editor file watchers, cloud sync) can temporarily exhaust the system's file descriptor table. The retry wrappers handle this transparently.

```typescript
// Drop-in replacement for fs/promises — used by both USC and eCFR converters
import { writeFile, mkdir } from "@lexbuild/core";

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, markdown, "utf-8");
```

## The Emit-at-Level Pattern

The emit-at-level pattern is the central memory management mechanism. The AST builder accepts an `emitAt` parameter specifying the level at which completed subtrees should be emitted (`section`, `chapter`, `part`, or `title`).

When the builder encounters the closing tag of an element at the configured level, it fires `onEmit` with the completed `LevelNode` and an `EmitContext` containing the ancestor chain (breadcrumbs from document root to the emitted node's parent) and document-level metadata. The emitted subtree is then detached from the builder's internal state and becomes eligible for garbage collection.

```typescript
const collected: CollectedSection[] = [];

const builder = new ASTBuilder({
  emitAt: "section",
  onEmit: (node, context) => {
    collected.push({ node, context });
  },
});
```

Levels above the emit level (e.g., `title` and `chapter` when emitting at `section`) are tracked as lightweight `AncestorInfo` objects -- just the level type, identifier, number, and heading. Their child subtrees are never accumulated, only passed through to the emit callback one section at a time.

## The Collect-Then-Write Pattern

Both USC and eCFR converters collect all emitted nodes synchronously during parsing, then write files after parsing completes. The collect phase pushes `{ node, context }` pairs into an array; the write phase iterates this array to render and write each file.

Three constraints drive this pattern:

1. **SAX events are synchronous.** The saxes parser fires events synchronously within `write()` calls. Performing async file I/O inside event handlers would require pausing the parser, which saxes does not support.

2. **Two-pass duplicate detection.** Some USC titles contain multiple sections with the same number within a chapter. The first pass counts occurrences and assigns `-2`, `-3` suffixes to duplicates. This requires seeing all sections before writing any.

3. **Two-pass link resolution.** Cross-references use relative Markdown links. Both forward and backward references must resolve, so all section identifiers and output paths must be registered before any rendering occurs.

```
Parse Phase (synchronous)          Write Phase (async)
─────────────────────────          ───────────────────
SAX event → builder.onEmit ──┐    ┌── Pass 1: compute paths, detect duplicates, register links
SAX event → builder.onEmit ──┤    ├── Pass 2: render Markdown, write files
SAX event → builder.onEmit ──┤    └── Pass 3: write _meta.json, README.md
              ...            ──┘
          collected[]  ──────────>
```

## Granularity Modes

### USC Granularity

| Mode | emitAt | Output Path | Metadata | Memory |
|------|--------|-------------|----------|--------|
| Section (default) | `section` | `usc/title-NN/chapter-NN/section-N.md` | `_meta.json` per chapter + title, `README.md` per title | Bounded (<10 MB) |
| Chapter | `chapter` | `usc/title-NN/chapter-NN/chapter-NN.md` | `_meta.json` per title, `README.md` per title | Bounded per chapter |
| Title | `title` | `usc/title-NN.md` | Enriched frontmatter only | **Unbounded** (500 MB+ for large titles) |

### eCFR Granularity

| Mode | emitAt | Output Path | Metadata | Memory |
|------|--------|-------------|----------|--------|
| Section (default) | `section` | `ecfr/title-NN/chapter-X/part-N/section-N.N.md` | `_meta.json` per part + title, `README.md` per title | Bounded (<10 MB) |
| Part | `part` | `ecfr/title-NN/chapter-X/part-N.md` | None | Bounded per part |
| Chapter | `section`* | `ecfr/title-NN/chapter-X/chapter-X.md` | None | Bounded per chapter |
| Title | `title` | `ecfr/title-NN.md` | None | **Unbounded** |

\* eCFR chapter granularity emits at section level, then groups sections by chapter ancestor into composite files during the write phase.

Title granularity holds the entire AST and rendered Markdown in memory simultaneously. Large titles (USC titles 26 and 42 exceed 100 MB XML; eCFR title 40 exceeds 150 MB) can require 500 MB+ resident memory. Section and chapter/part granularity keep memory bounded by releasing each subtree after it is written.

## Memory Profile

Components held in memory during section-level conversion of a single title:

| Component | Typical Size | Notes |
|-----------|-------------|-------|
| SAX parser buffer | ~64 KB | saxes internal chunk buffer |
| AST builder stack | ~5 KB | `StackFrame` objects for open elements |
| Current section AST | up to ~500 KB | Largest sections (tax code definitions) |
| Document metadata | ~2 KB | `DocumentMeta` object |
| Link resolver registry | ~100 bytes x N | One entry per section (identifier + path) |
| File write buffer | ~64 KB | Node.js `fs` write buffer |
| **Worst case total** | **< 10 MB** | Per title, excluding collected[] array |

The `collected[]` array holds all emitted `{ node, context }` pairs until the write phase completes. For large titles with thousands of sections, this array is the primary memory consumer during the brief window between parse completion and write completion. Each entry is released after its file is written in a production-optimized build, but the current implementation retains all entries for the two-pass link resolution and duplicate detection passes.
