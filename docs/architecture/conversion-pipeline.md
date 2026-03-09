# Conversion Pipeline

The conversion pipeline transforms legislative XML into structured Markdown through four stages: SAX parsing, AST construction, Markdown rendering, and file writing. The pipeline is streaming by default -- for section and chapter granularity, only one emitted subtree is held in memory at a time. This design allows LexBuild to process XML files exceeding 100 MB without proportional memory growth.

## End-to-End Data Flow

```
input.xml
    │
    ▼
┌──────────────────────────────┐
│  1. SAX Parser               │
│     XMLParser (saxes)        │
│     Streaming events:        │
│       openElement            │
│       closeElement           │
│       text                   │
└─────────────┬────────────────┘
              │ events
              ▼
┌──────────────────────────────┐
│  2. AST Builder              │
│     Stack-based construction │
│     Emits at configured      │──── <meta> ──→ DocumentMeta (held in memory)
│     level (section/chapter/  │
│     title)                   │
└─────────────┬────────────────┘
              │ onEmit(node, context)
              ▼
┌──────────────────────────────┐
│  3. Markdown Renderer        │
│     + Frontmatter Generator  │
│     + Link Resolver          │
│     AST → Markdown string    │
└─────────────┬────────────────┘
              │
              ▼
┌──────────────────────────────┐
│  4. File Writer              │
│     Write .md files          │
│     Generate _meta.json      │
│     Generate README.md       │
└─────────────┬────────────────┘
              │
              ▼
         output/usc/title-01/chapter-01/section-1.md
```

### Stage 1: SAX Parsing

The `XMLParser` class (in `@lexbuild/core`) wraps the `saxes` streaming parser with namespace normalization and a typed event emitter. It accepts both complete strings (`parseString()`) and Node.js readable streams (`parseStream()`).

Namespace normalization simplifies downstream handling: elements in the default USLM namespace emit bare names (e.g., `section`, `heading`), while elements in other namespaces emit prefixed names (e.g., `xhtml:table`, `dc:title`). This means the AST builder can match element names with simple string comparisons rather than namespace-aware lookups.

### Stage 2: AST Construction

The `ASTBuilder` consumes parser events and maintains a stack of `StackFrame` objects. Each frame represents an in-progress element and tracks its kind (`level`, `content`, `inline`, `note`, `ignore`, etc.), the AST node being built, and a text buffer. When an element closes, its frame pops and the completed node attaches to the parent frame.

Element classification is handled via static lookup sets defined in `@lexbuild/core`'s namespace module: `LEVEL_ELEMENTS`, `CONTENT_ELEMENTS`, `INLINE_ELEMENTS`, `NOTE_ELEMENTS`, and others. The builder maps XML element names to AST node constructors using these sets and an inline type map.

Two special subsystems handle complex structures:

- **Table collectors** -- XHTML tables (`xhtml:table`) and USLM layout tables (`<layout>`) use dedicated collector state machines, activated before normal element handlers. This isolates table-building logic from the main stack.
- **Text bubbling** -- text inside nested inline elements (e.g., `<heading><b>Editorial Notes</b></heading>`) is bubbled up to the appropriate collector frame so it accumulates correctly.

The builder also extracts document-level metadata from the `<meta>` block into a `DocumentMeta` structure, which is held in memory for the duration of parsing.

For full details on the AST node types the builder produces, see [AST Model](./ast-model.md).

### Stage 3: Markdown Rendering

The renderer is stateless and pure -- given an AST node and `RenderOptions`, it returns a Markdown string. No side effects, no file I/O. Three entry points serve different scopes:

- `renderDocument()` -- full document: YAML frontmatter + Markdown content
- `renderSection()` -- a section-level node's heading and body
- `renderNode()` -- dispatches to the appropriate handler for any node type

`RenderOptions` controls heading offset, link style (`relative`, `canonical`, or `plaintext`), a custom link resolver function, and notes filtering. The `NotesFilter` selectively includes or excludes editorial, statutory, and amendment notes at render time without modifying the AST.

Cross-reference links are resolved via the `LinkResolver` interface. During conversion, each written section's USLM identifier is registered with `register()`. When a `<ref>` node is rendered, the resolver looks up the target identifier. Successful lookups produce relative Markdown links; failures fall back to OLRC website URLs via `fallbackUrl()`. References to non-USC identifiers (`/us/stat/...`, `/us/pl/...`) always render as plain text citations.

### Stage 4: File Writing

Source packages handle file writing. The `@lexbuild/usc` converter uses a collect-then-write pattern: all emitted AST nodes are collected synchronously during SAX parsing, then written to disk after parsing completes. This avoids async I/O during SAX event handlers (which cannot be paused for backpressure) and enables a two-pass strategy for duplicate section detection and link resolution.

After all Markdown files are written, the converter generates sidecar metadata: `_meta.json` index files per directory and `README.md` overview files per title (section and chapter granularity only).

## The Emit-at-Level Pattern

The emit-at-level pattern is the central memory management mechanism. The `ASTBuilder` accepts an `emitAt` parameter specifying which hierarchical level triggers emission:

```typescript
const builder = new ASTBuilder({
  emitAt: "section",
  onEmit: (node, context) => {
    collected.push({ node, context });
  },
});
```

When the configured level's closing tag is processed, `onEmit` fires with the completed `LevelNode` and an `EmitContext` containing the ancestor chain (title, chapter, subchapter, etc.) and document metadata. The subtree is then detached from the builder's stack and can be garbage-collected.

This means the builder never holds more than one emitted subtree at a time. For section-level emission, the AST of a single section is in memory; for chapter-level, a single chapter; for title-level, the entire document.

The `EmitContext` carries enough information for the converter to determine output paths, generate frontmatter, and resolve cross-references without re-traversing the XML.

## Granularity Modes

The pipeline's behavior varies by output granularity. All three modes share the same SAX parser and AST builder -- only the `emitAt` level and the write phase differ.

### Section Granularity (default)

- **`emitAt: "section"`** -- one AST node emitted per `<section>` element
- **Output**: `usc/title-NN/chapter-NN/section-N.md`
- **Sidecar**: `_meta.json` per chapter and title directory, `README.md` per title
- **Memory**: bounded -- only one section's AST in memory at a time

This is the default and recommended mode for RAG pipelines. Each section is the smallest independently citable unit in the U.S. Code, making it a natural chunk boundary.

### Chapter Granularity

- **`emitAt: "chapter"`** -- one AST node emitted per chapter-level element
- **Output**: `usc/title-NN/chapter-NN/chapter-NN.md`
- **Sidecar**: `_meta.json` per title directory, `README.md` per title
- **Memory**: bounded -- one chapter's AST in memory at a time (larger than section mode, but still manageable)

Each chapter file contains all its sections rendered inline with heading hierarchy. Useful when downstream consumers prefer fewer, larger files.

### Title Granularity

- **`emitAt: "title"`** -- the entire document is one emitted node
- **Output**: `usc/title-NN.md` (flat file, no subdirectories)
- **Sidecar**: none -- enriched frontmatter with `chapter_count`, `section_count`, and `total_token_estimate` replaces sidecar files
- **Memory**: unbounded -- the full title AST and rendered Markdown are held in memory simultaneously

Title granularity is the exception to streaming. Large titles (26, 42) can require 500 MB+ RSS. Use this mode only when a single-file-per-title output is specifically needed.

## Memory Profile

At any point during section-level conversion, memory usage breaks down as follows:

| Component | Memory |
|-----------|--------|
| SAX parser internal buffer | ~64 KB |
| AST builder stack (ancestors only) | ~1 KB per level x ~5 levels = ~5 KB |
| Current section AST | Varies; largest sections ~500 KB (Title 26) |
| Document metadata | ~2 KB |
| Link resolver registry | ~100 bytes per section converted so far |
| File write buffer | ~64 KB |
| **Worst case total** | **< 10 MB per title** |

Verified end-to-end: all 54 titles (58 files including appendices), 60,261 sections, ~25 seconds. Peak memory for the largest title (Title 42, 107 MB XML) is ~661 MB RSS -- though this measurement includes Node.js runtime overhead and is taken at the RSS level, not net heap.

## How Source Packages Plug In

The pipeline is designed so that new source packages can reuse core infrastructure while providing source-specific orchestration. A new source package (e.g., `@lexbuild/cfr` for the Code of Federal Regulations) would:

1. **Parse source XML** using `XMLParser` (or a custom parser if the source uses a different schema).
2. **Build AST nodes** using `ASTBuilder` configured with the appropriate `emitAt` level. If the source's XML schema differs substantially from USLM, the package may need to extend or replace the builder while producing the same AST node types.
3. **Render to Markdown** using the shared `renderDocument()`, `renderSection()`, and `renderNode()` functions. Since the renderer operates on AST nodes (not XML), any source that produces valid AST nodes gets Markdown rendering for free.
4. **Write output files** using source-specific path conventions, with sidecar metadata as appropriate.

The key contract is the AST type system: as long as a source package produces `LevelNode`, `ContentNode`, `InlineNode`, and the other node types defined in `@lexbuild/core`, it can use the full rendering pipeline. Output format remains consistent across sources, so downstream consumers (RAG pipelines, search indexes, the web app) work identically regardless of which legal source produced the Markdown.

