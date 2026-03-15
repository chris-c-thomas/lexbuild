# Dependency Graph

LexBuild's packages follow a strict layered dependency model: a shared core at the bottom, source-specific packages in the middle, and a CLI orchestrator at the top. This page documents the current dependency relationships, the rules that govern them, and how the graph evolves as new source packages are added.

## Current State

```
@lexbuild/cli  (v1.4.2)
  ├── @lexbuild/usc          workspace:*
  │     └── @lexbuild/core   workspace:*
  └── @lexbuild/core         workspace:*  (direct dep for shared types)
```

The CLI depends on both `@lexbuild/usc` and `@lexbuild/core`. The direct dependency on core is intentional -- the CLI imports shared types (like `ConvertOptions`, `ConvertResult`) that are defined in or re-exported through core, and may use core utilities for formatting or validation independent of any source package.

### External Dependencies

Each package also has third-party dependencies. Here is the complete picture:

```
@lexbuild/cli
  ├── @lexbuild/core         (workspace:*)
  ├── @lexbuild/usc          (workspace:*)
  ├── commander              (CLI framework)
  ├── chalk                  (terminal colors)
  ├── ora                    (spinners)
  ├── cli-table3             (formatted tables)
  ├── pino                   (structured logging)
  └── pino-pretty            (log formatting)

@lexbuild/usc
  ├── @lexbuild/core         (workspace:*)
  └── yauzl                  (ZIP extraction for OLRC downloads)

@lexbuild/core
  ├── saxes                  (SAX streaming XML parser)
  ├── yaml                   (YAML serialization for frontmatter)
  └── zod                    (schema validation)
```

The Astro app (`apps/astro/`) sits outside the package dependency graph entirely. It consumes LexBuild's output files (`.md` and `_meta.json`), not its code. It has no `workspace:*` dependency on any `@lexbuild` package.

## Dependency Rules

Three rules govern how packages relate to each other. These rules are not enforced by tooling -- they are architectural conventions that keep the system modular and extensible.

### Rule 1: Source packages depend on core, never on each other

Every source package (currently `usc`, eventually `cfr`, `state-*`, etc.) depends on `@lexbuild/core` for infrastructure. Source packages never import from or depend on other source packages.

This rule ensures that source packages can be developed, tested, built, and published independently. A contributor working on CFR support does not need to understand USC-specific code, and a bug in one source package cannot break another.

### Rule 2: The CLI depends on all source packages it supports

The CLI is the user-facing entry point. It imports from every source package to register the corresponding commands (`download`, `convert`, and future source-specific variants). The CLI contains no conversion or download logic of its own -- it delegates entirely to source packages.

### Rule 3: Core depends on no internal packages

`@lexbuild/core` has zero `workspace:*` dependencies. It builds first, with no internal prerequisites. This makes it the stable foundation that everything else builds on. Changes to core's public API affect all downstream packages, so its interfaces evolve carefully.

## What Each Dependency Edge Means

### Core provides to source packages

Source packages import the following from `@lexbuild/core`:

| Import | Purpose |
|--------|---------|
| `XMLParser` | Streaming SAX parser with namespace normalization |
| `ASTBuilder` | Stack-based XML-to-AST conversion with configurable emit level |
| `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, ... | AST node type definitions |
| `EmitContext`, `DocumentMeta` | Metadata passed alongside emitted AST nodes |
| `renderDocument`, `renderSection`, `renderNode` | AST-to-Markdown conversion |
| `generateFrontmatter` | YAML frontmatter from structured metadata |
| `createLinkResolver` | Cross-reference resolution with fallback URLs |
| `BIG_LEVELS`, `SMALL_LEVELS` | Level classification sets |
| `FORMAT_VERSION`, `GENERATOR` | Output format versioning constants |

In practice, a source package calls `XMLParser` to stream events into `ASTBuilder`, receives completed AST subtrees via the `onEmit` callback, renders them with `renderDocument`, and writes the resulting Markdown to disk. All USLM element handling is built into `ASTBuilder` -- source packages do not register custom element handlers (though this may change as the extension architecture evolves).

### Source packages provide to the CLI

The CLI imports the following from `@lexbuild/usc` (and will import analogous exports from future source packages):

| Import | Purpose |
|--------|---------|
| `convertTitle()` | Orchestrates the full conversion pipeline for a single XML file |
| `downloadTitles()` | Fetches XML from OLRC (single titles or bulk download) |
| `ConvertOptions`, `ConvertResult` | Type definitions for conversion input/output |
| `DownloadOptions`, `DownloadResult` | Type definitions for download input/output |
| `CURRENT_RELEASE_POINT` | Current OLRC release point identifier (e.g., `"119-73not60"`) |
| `USC_TITLE_NUMBERS` | Array of valid title numbers (`[1, 2, ..., 54]`) |
| Utility functions | `buildDownloadUrl`, `isAllTitles`, `parseTitles`, etc. |

The CLI wraps these functions with argument parsing (via `commander`), progress UI (via `ora` and `chalk`), and result formatting (via `cli-table3`). It adds no domain logic.

## Future Projection

As new source packages are added, the graph grows horizontally at the middle layer. Source packages remain independent of each other, and the CLI gains new commands:

```
@lexbuild/cli
  ├── @lexbuild/usc              (U.S. Code — USLM 1.0 XML)
  │     └── @lexbuild/core
  ├── @lexbuild/cfr              (Code of Federal Regulations — USLM 2.x XML)
  │     └── @lexbuild/core
  ├── @lexbuild/state-il         (Illinois Compiled Statutes — HTML)
  │     └── @lexbuild/core
  └── @lexbuild/core             (shared by all)
```

Each new source package would:

- Depend on `@lexbuild/core` via `workspace:*`
- Export a converter function (e.g., `convertRegulation()`, `convertStatute()`)
- Optionally export a downloader function for bulk data retrieval
- Register one or more new commands in the CLI (e.g., `lexbuild download-cfr`, `lexbuild convert-cfr`)

### Parallel Development

The independence rule makes parallel development straightforward. Two teams could work on `@lexbuild/cfr` and `@lexbuild/state-il` simultaneously without merge conflicts or coordination overhead, as long as they both build against core's stable API. Turborepo's `--filter` flag lets each team build and test their package in isolation:

```bash
pnpm turbo build --filter=@lexbuild/cfr
pnpm turbo test --filter=@lexbuild/cfr
```

### Output Consistency

All source packages share core's AST types, Markdown renderer, and frontmatter generator. This means the output format is consistent across sources -- downstream consumers (RAG pipelines, search indexes, the web app) work identically regardless of which legal source produced the Markdown. A `_meta.json` sidecar from a CFR conversion would have the same structure as one from a USC conversion.

## Visualizing the Layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLI Layer                                   │
│                                                                          │
│   @lexbuild/cli                                                          │
│   Argument parsing, progress UI, result formatting                       │
│   Delegates all domain logic to source packages                          │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                           Source Layer                                   │
│                                                                          │
│   @lexbuild/usc       @lexbuild/cfr (future)     @lexbuild/state-il      │
│   USC converter        CFR converter              (future)               │
│   OLRC downloader      eCFR downloader            IL statutes            │
│   File writer          File writer                converter              │
│                                                                          │
│   Each source package is independent — no cross-dependencies             │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                           Core Layer                                     │
│                                                                          │
│   @lexbuild/core                                                         │
│   XML parser, AST types & builder, Markdown renderer                     │
│   Frontmatter generator, link resolver                                   │
│   No internal dependencies — builds first, changes carefully             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

                         ╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶╶

┌──────────────────────────────────────────────────────────────────────────┐
│                            Apps Layer                                    │
│                                                                          │
│   apps/astro/                                                            │
│   Consumes output files (.md + _meta.json), not package code             │
│   No workspace:* dependency on any @lexbuild package                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

The apps layer is separated by a dotted line because it has no code dependency on the package layers. It consumes the *output* of the platform, not its API. This decoupling means the Astro app (or any future app) works with any content that conforms to the output format, regardless of which source package produced it.
