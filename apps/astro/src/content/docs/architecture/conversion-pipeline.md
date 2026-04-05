---
title: Conversion Pipeline
description: How LexBuild transforms legislative XML into structured Markdown through four stages -- SAX parsing, AST construction, Markdown rendering, and file output.
order: 2
---

The conversion pipeline transforms legislative XML into structured Markdown through four stages: SAX parsing, AST construction, Markdown rendering, and file writing. The pipeline is streaming by default. For section and chapter/part granularity, only one emitted subtree is held in memory at a time, keeping memory usage bounded even for XML files exceeding 100 MB.

## Overview

```
input.xml --> [1. SAX Parser] --> [2. AST Builder] --> [3. Renderer] --> [4. File Writer] --> output/
              XMLParser/saxes     ASTBuilder (USLM)    Markdown +        writeFile/mkdir
              namespace           EcfrASTBuilder        Frontmatter +
              normalization       FrASTBuilder          Link Resolver
```

Stage 1 is shared across all sources. Stage 2 is source-specific -- each XML format has its own builder that produces the same shared AST node types. Stages 3 and 4 are source-agnostic: the renderer operates on the common AST, and file I/O uses the same resilient wrappers regardless of source.

## Stage 1: SAX Parsing

`XMLParser` in `@lexbuild/core` wraps the saxes library with namespace normalization and a typed event emitter. It exposes three events: `openElement`, `closeElement`, and `text`.

### Why SAX Over DOM

Large titles like USC Title 26 (Internal Revenue Code) and Title 42 can exceed 100 MB of XML. eCFR Title 40 exceeds 150 MB. Loading these into a DOM tree would require gigabytes of memory. SAX streaming processes elements as they arrive without buffering the full document, keeping memory independent of input file size.

### Namespace Normalization

Elements in the default namespace (USLM for USC) emit bare names (`section`, `heading`). Elements in other recognized namespaces emit prefixed names (`xhtml:table`, `dc:title`). eCFR and FR XML have no namespace declarations, so the parser is configured with an empty default namespace and all elements emit bare names directly.

### Two Parsing Modes

- **`parseString(xml)`** -- Synchronous, used in tests.
- **`parseStream(stream)`** -- Production streaming via `fs.createReadStream`. Returns a Promise that resolves when parsing completes.

The parser passes SAX events to the builder as chunks arrive from the read stream, so the parser never buffers the entire document.

## Stage 2: AST Construction

Source-specific builders consume parser events and produce the shared AST node types. All builders implement the same interface (`onOpenElement`, `onCloseElement`, `onText`) and emit completed subtrees through the `onEmit` callback.

### USLM Builder (U.S. Code)

`ASTBuilder` in `@lexbuild/core` handles USLM 1.0 XML. It uses a stack-based state machine where each in-progress XML element pushes a `StackFrame` onto the stack.

Incoming element names are classified into handling groups:

| Group | Examples | Behavior |
|---|---|---|
| Level elements | `title`, `chapter`, `section`, `subsection` | Push level frame, track ancestors |
| Content elements | `content`, `chapeau`, `continuation`, `proviso` | Push content frame, collect inline children |
| Inline elements | `b`, `i`, `ref`, `date`, `term`, `sup`, `sub` | Push inline frame, map to inline type |
| Note elements | `note`, `statutoryNote`, `editorialNote` | Push note frame |

XHTML tables and USLM layout tables use dedicated collector state machines. When the parser enters a table element, a `TableCollector` accumulates header rows, body rows, and cell text. On close, the collector produces a `TableNode` and attaches it to the parent frame. This isolation keeps table-building logic separate from the main stack.

### eCFR Builder

`EcfrASTBuilder` in `@lexbuild/ecfr` follows the same stack-based, emit-at-level pattern but dispatches on eCFR element names.

eCFR uses numbered DIV elements (`DIV1` through `DIV9`) where the `TYPE` attribute determines semantic meaning. For example, `DIV1` with `TYPE="TITLE"` maps to a title-level node, `DIV5` with `TYPE="PART"` maps to a part, and `DIV8` with `TYPE="SECTION"` maps to a section.

Unlike USLM's nested `<subsection>`/`<paragraph>`/`<clause>` hierarchy, eCFR sections contain flat `<P>` elements with numbering prefixes like `(a)`, `(1)`, `(i)`. The builder treats these as content blocks rather than nested levels.

### FR Builder

`FrASTBuilder` in `@lexbuild/fr` handles Federal Register GPO/SGML XML. Each FR document element (`RULE`, `NOTICE`, `PRORULE`, `PRESDOCU`) is emitted as a single section-level `LevelNode`. There is no hierarchy within documents, so no granularity options are needed.

The FR builder also extracts preamble metadata (`AGENCY`, `SUBAGY`, `CFR`, `SUBJECT`, `RIN`) during parsing and enriches frontmatter with structured JSON metadata when a `.json` sidecar file from the FederalRegister.gov API is available.

All three builders produce the same AST types (`LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, etc.), so the rendering pipeline works identically for all sources.

## The Emit-at-Level Pattern

The emit-at-level pattern is the central memory management mechanism. You configure the builder with an `emitAt` parameter specifying which level triggers emission (`section`, `chapter`, `part`, or `title`).

When the builder encounters the closing tag of an element at the configured level, it fires `onEmit` with the completed `LevelNode` and an `EmitContext`. The context includes the ancestor chain (breadcrumbs from document root to the emitted node's parent) and document-level metadata. The emitted subtree is then detached from the builder's internal state and becomes eligible for garbage collection.

```typescript
const collected: CollectedSection[] = [];

const builder = new ASTBuilder({
  emitAt: "section",
  onEmit: (node, context) => {
    collected.push({ node, context });
  },
});
```

Levels above the emit level (for example, `title` and `chapter` when emitting at `section`) are tracked as lightweight `AncestorInfo` objects containing just the level type, identifier, number, and heading. Their child subtrees are never accumulated in memory.

## The Collect-Then-Write Pattern

Both USC and eCFR converters collect all emitted nodes synchronously during parsing, then write files after parsing completes. The collect phase pushes `{ node, context }` pairs into an array; the write phase iterates this array to render and write each file.

Three constraints drive this pattern:

1. **SAX events are synchronous.** The saxes parser fires events synchronously within `write()` calls. You cannot perform async file I/O inside event handlers because saxes does not support pausing.

2. **Two-pass duplicate detection.** Some USC titles contain multiple sections with the same number within a chapter. The first pass counts occurrences and assigns `-2`, `-3` suffixes to duplicates. This requires seeing all sections before writing any.

3. **Two-pass link resolution.** Cross-references use relative Markdown links. Both forward and backward references must resolve, so all section identifiers and output paths must be registered before rendering.

```
Parse Phase (synchronous)          Write Phase (async)
SAX event --> builder.onEmit --+   +-- Pass 1: compute paths, detect duplicates, register links
SAX event --> builder.onEmit --+   +-- Pass 2: render Markdown, write files
SAX event --> builder.onEmit --+   +-- Pass 3: write _meta.json, README.md
              ...              --+
          collected[]  ---------->
```

## Stage 3: Markdown Rendering

The renderer in `@lexbuild/core` is stateless and pure -- no side effects, no file I/O. It converts AST nodes to Markdown strings.

### Entry Points

| Function | Purpose |
|---|---|
| `renderDocument(node, frontmatter, options)` | Full document: YAML frontmatter + Markdown content |
| `renderSection(node, options)` | Section heading and body |
| `renderNode(node, options)` | Dispatch by node type (level, content, inline, note, table) |

### Render Options

`RenderOptions` controls output behavior:

- **`headingOffset`** -- Shifts heading levels (0 means sections render as H1).
- **`linkStyle`** -- `"relative"` (resolved paths), `"canonical"` (source website URLs), or `"plaintext"` (text only).
- **`resolveLink`** -- A function injected by the converter to resolve identifiers to relative file paths.
- **`notesFilter`** -- Selectively include or exclude editorial, statutory, and amendment notes.

### Cross-Reference Resolution

The `LinkResolver` in `@lexbuild/core` provides a register/resolve/fallback pattern:

1. During the first pass, all section identifiers are registered with their output file paths.
2. During the second pass (rendering), `resolveLink` queries the registry and computes relative paths.
3. Unresolvable USC identifiers fall back to uscode.house.gov URLs.
4. Unresolvable CFR identifiers fall back to ecfr.gov URLs.
5. Unresolvable FR identifiers fall back to federalregister.gov URLs.
6. Non-USC/CFR/FR references (Statutes at Large, Public Laws) render as plain text.

### Frontmatter Generation

`generateFrontmatter()` produces ordered YAML with `---` delimiters. Every file includes a `source` discriminator (`"usc"`, `"ecfr"`, or `"fr"`) and a `legal_status` field. Source-specific optional fields (such as `authority` and `cfr_part` for eCFR, or `document_number` and `agencies` for FR) are included when defined.

## Stage 4: File Writing

Source packages handle file writing using core's resilient `writeFile` and `mkdir` wrappers. These retry on `ENFILE`/`EMFILE` errors with exponential backoff (initial delay 50ms, max 5s, up to 10 retries). When the pipeline writes 60,000+ files in rapid succession, external processes like Spotlight and editor file watchers can temporarily exhaust the system's file descriptor table. The retry wrappers handle this transparently.

After Markdown files are written, sidecar metadata (`_meta.json` per directory, `README.md` per title) is generated for section-level granularity.

## Granularity Modes

The `emitAt` parameter controls how much content goes into each output file. Different granularities trade off between file count, file size, and memory usage.

### USC Granularity

| Mode | Output Pattern | Sidecar Files | Memory |
|---|---|---|---|
| Section (default) | `usc/title-NN/chapter-NN/section-N.md` | `_meta.json` + `README.md` | Bounded (< 10 MB) |
| Chapter | `usc/title-NN/chapter-NN/chapter-NN.md` | `_meta.json` + `README.md` | Bounded per chapter |
| Title | `usc/title-NN.md` | Enriched frontmatter only | Unbounded |

### eCFR Granularity

| Mode | Output Pattern | Memory |
|---|---|---|
| Section (default) | `ecfr/title-NN/chapter-X/part-N/section-N.N.md` | Bounded (< 10 MB) |
| Part | `ecfr/title-NN/chapter-X/part-N.md` | Bounded per part |
| Chapter | `ecfr/title-NN/chapter-X/chapter-X.md` | Bounded per chapter |
| Title | `ecfr/title-NN.md` | Unbounded |

Title granularity holds the entire AST and rendered Markdown in memory simultaneously. Large titles can require 500 MB+ of resident memory. Section and chapter/part granularity release each subtree after it is written, keeping memory bounded.

## Memory Profile

At section-level granularity, the components held in memory during conversion of a single title are:

| Component | Typical Size |
|---|---|
| SAX parser buffer | ~64 KB |
| AST builder stack | ~5 KB |
| Current section AST | Up to ~500 KB |
| Document metadata | ~2 KB |
| Link resolver registry | ~100 bytes per section |
| File write buffer | ~64 KB |
| **Worst case total** | **< 10 MB per title** |

The `collected[]` array holds all emitted `{ node, context }` pairs until the write phase completes. For large titles with thousands of sections, this array is the primary memory consumer during the window between parse completion and write completion.
