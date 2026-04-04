# Architecture Overview

LexBuild is a platform for converting legislative XML into structured Markdown optimized for AI ingestion. It supports three source formats -- U.S. Code (USLM 1.0 schema), eCFR (GPO/SGML-derived XML), and Federal Register (GPO/SGML via FederalRegister.gov API) -- with an architecture designed for additional sources.

The system is organized as a TypeScript monorepo with five packages and two applications, arranged in three dependency layers. Each layer depends only on the layer below it, enforcing a clean separation between shared infrastructure, source-specific logic, and user-facing interfaces.

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3: Applications & CLI                                        │
│                                                                     │
│  @lexbuild/cli                        apps/astro                    │
│  ┌──────────────────────────┐         ┌──────────────────────────┐  │
│  │  download-usc            │         │  Astro 6 SSR site        │  │
│  │  convert-usc             │         │  (lexbuild.dev)          │  │
│  │  download-ecfr           │         │                          │  │
│  │  convert-ecfr            │         │  Consumes output files,  │  │
│  │  download-fr             │         │  not packages             │  │
│  │  convert-fr              │         │                          │  │
│  │                          │         │  not packages             │  │
│  └──────────┬───────────────┘         └──────────────────────────┘  │
│             │                                                       │
├─────────────┼───────────────────────────────────────────────────────┤
│  Layer 2:   │ Source Packages                                       │
│             │                                                       │
│  ┌──────────┴──────────┐  ┌─────────────────────┐  ┌────────────┐  │
│  ┌──────────┴──────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │  @lexbuild/usc      │  │  @lexbuild/ecfr     │  │  @lexbuild/fr       │  │
│  │                     │  │                     │  │                     │  │
│  │  OLRC downloader    │  │  eCFR API/govinfo   │  │  FR API downloader  │  │
│  │  Conversion pipeline│  │  downloader         │  │  FrASTBuilder       │  │
│  │  (uses core's       │  │  EcfrASTBuilder     │  │  Conversion pipeline│  │
│  │   ASTBuilder)       │  │  Conversion pipeline│  │  (dual JSON+XML)    │  │
│  └──────────┬──────────┘  └──────────┬──────────┘  └──────────┬──────────┘  │
│             │                        │                    │         │
├─────────────┼────────────────────────┼────────────────────┼─────────┤
│  Layer 1:   │ Core Infrastructure    │                    │         │
│             │                        │                    │         │
│  ┌──────────┴────────────────────────┴────────────────────┴──────┐  │
│  │  @lexbuild/core                                              │  │
│  │                                                              │  │
│  │  XML Parser (SAX)  ·  AST Builder (USLM)  ·  AST Types      │  │
│  │  Markdown Renderer ·  Frontmatter Generator                  │  │
│  │  Link Resolver     ·  Resilient File I/O                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer 1: Core Infrastructure (`@lexbuild/core`)

The core package is the source-agnostic foundation that every other package depends on. It provides the shared pipeline stages and data types that make multi-source conversion possible.

**Key modules:**

- **XML Parser** -- Streaming SAX parser built on [saxes](https://github.com/lddubeau/saxes) with namespace normalization. Handles documents exceeding 100 MB without loading them into memory.
- **AST Builder** -- Stack-based state machine that converts SAX events into LexBuild AST nodes. Uses the emit-at-level pattern to stream completed subtrees as they close, rather than holding the full document in memory. The USLM builder (for U.S. Code XML) lives in core.
- **Markdown Renderer** -- Stateless, pure-function pipeline that transforms AST nodes into Markdown text. Entry points include `renderDocument`, `renderSection`, and `renderNode`. Source-agnostic by design -- it operates on AST types, not XML elements.
- **Frontmatter Generator** -- Produces YAML frontmatter (FORMAT_VERSION 1.1.0) with multi-source support. Every output file includes a `source` discriminator (`"usc"`, `"ecfr"`, or `"fr"`) and a `legal_status` field (`"official_legal_evidence"`, `"official_prima_facie"`, or `"authoritative_unofficial"`). Source-specific optional fields are included when relevant.
- **Link Resolver** -- Register/resolve/fallback system for cross-references. Handles USC (`/us/usc/`), CFR (`/us/cfr/`), and FR (`/us/fr/`) identifier schemes, producing relative Markdown links within the converted corpus. Unresolved references fall back to source website URLs (OLRC for USC, ecfr.gov for CFR, federalregister.gov for FR).
- **Resilient File I/O** -- `writeFile` and `mkdir` wrappers that retry on `ENFILE`/`EMFILE` errors with exponential backoff. Prevents file descriptor exhaustion when writing 60,000+ files while external processes (Spotlight, editor file watchers) react to the new files.

See [Conversion Pipeline](./conversion-pipeline.md), [AST Model](./ast-model.md), and [Core Package](../packages/core.md) for detailed documentation.

### Layer 2: Source Packages

Each legal source format gets its own package. Source packages depend on `@lexbuild/core` and are independent of each other -- they never import from one another.

A source package typically provides:

- **A source-specific AST builder** (if the XML format differs from USLM). The eCFR package has its own `EcfrASTBuilder` because GPO/SGML XML uses a fundamentally different structure.
- **A converter function** using the collect-then-write pattern: sections are collected during SAX streaming and written after the stream completes, avoiding async issues during SAX event processing.
- **An optional downloader** for fetching bulk data from the source's distribution endpoint.
- **Source-specific post-processing** such as identifier construction, deduplication, or hierarchy inference.

**Current source packages:**

| Package | Source | XML Format | AST Builder |
|---------|--------|------------|-------------|
| `@lexbuild/usc` | U.S. Code (OLRC) | USLM 1.0 (namespaced, hierarchical) | Core's `ASTBuilder` (shared) |
| `@lexbuild/ecfr` | eCFR (ecfr.gov / govinfo) | GPO/SGML (DIV-based, no namespaces, flat paragraphs) | Own `EcfrASTBuilder` |
| `@lexbuild/fr` | Federal Register (federalregister.gov) | GPO/SGML (document-centric, flat, no namespaces) | Own `FrASTBuilder` |

The architecture grows horizontally. New sources produce the same AST node types and feed them to core's shared renderer, keeping output format consistent across all legal corpora.

See [USC Package](../packages/usc.md), [eCFR Package](../packages/ecfr.md), and [FR Package](../packages/fr.md) for source-specific details.

### Layer 3: Applications & CLI

The top layer contains user-facing interfaces. Neither component contains conversion logic -- they delegate to source packages or consume pre-built output.

- **`@lexbuild/cli`** -- Command-line interface built with [commander](https://github.com/tj/commander.js). Provides `download-usc`, `convert-usc`, `download-ecfr`, `convert-ecfr`, `download-fr`, and `convert-fr` commands following a `{action}-{source}` naming pattern. The CLI handles argument parsing, progress display, and error reporting. All conversion work is delegated to the source packages.
- **`apps/astro`** -- Astro 6 SSR web application served at [lexbuild.dev](https://lexbuild.dev). Provides a browsable interface for the converted content with full-text search via Meilisearch. Has **no code dependency** on any `@lexbuild/*` package -- it consumes the output Markdown files and `_meta.json` sidecar indexes directly from the filesystem.
- **`apps/api`** -- Hono REST API served at [lexbuild.dev/api](https://lexbuild.dev/api). Provides programmatic access to the corpus from a SQLite database with full text search via Meilisearch. Depends on `@lexbuild/core` for shared database schema types but has no dependency on source packages. Content is populated by the `lexbuild ingest` CLI command.

See the [CLI](../packages/cli.md) package, the [Astro](../apps/astro.md) app, and the [Data API](../apps/api.md).

## Package Dependency Graph

```
@lexbuild/cli
  ├── @lexbuild/usc
  │     └── @lexbuild/core
  ├── @lexbuild/ecfr
  │     └── @lexbuild/core
  ├── @lexbuild/fr
  │     └── @lexbuild/core
  └── @lexbuild/core (direct dependency for shared types)

apps/astro
  └── (no package dependencies — consumes output files only)

apps/api
  └── @lexbuild/core (shared database schema types and key hashing utilities)
```

All internal dependencies use the pnpm `workspace:*` protocol. Turborepo builds packages in topological order: `core` first, then `usc`, `ecfr`, and `fr` in parallel, then `cli`. All packages use lockstep versioning managed by [Changesets](https://github.com/changesets/changesets).

## Design Philosophy

Five principles guide the architecture:

1. **SAX over DOM.** Large titles (such as Title 26 and Title 42) can exceed 100 MB of XML. SAX streaming processes elements as they arrive without loading the full document tree, keeping memory usage bounded regardless of input size.

2. **AST-based pipeline.** Source-specific builders translate their XML format into a shared set of AST node types. The renderer operates on these types, not on XML elements, which means adding a new source format does not require changes to the rendering layer.

3. **Section as the atomic unit.** A section is the smallest independently citable unit in both the U.S. Code and the Code of Federal Regulations. Subsections, paragraphs, and clauses are rendered within the section file rather than as separate output files.

4. **Multi-source consistency.** All sources produce the same Markdown format, frontmatter schema, and `_meta.json` sidecar files. A consumer ingesting LexBuild output does not need source-specific parsing logic -- the `source` field in frontmatter is the only differentiator.

5. **Streaming output.** At section and chapter/part granularity, the converter writes output files as sections are collected during SAX processing rather than accumulating the full title in memory. Title granularity is the deliberate exception: it holds the entire title AST and rendered Markdown in memory to produce a single output file.
