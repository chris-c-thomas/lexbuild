# Architecture Overview

LexBuild is a platform for converting legislative XML into structured Markdown optimized for AI ingestion, RAG pipelines, and semantic search. It is designed as a layered monorepo: a format-agnostic core infrastructure handles XML parsing, AST construction, and Markdown rendering, while source packages (currently `usc` for the U.S. Code) provide source-specific orchestration and downloading. A thin CLI and an optional web app sit on top, consuming the packages without containing conversion logic themselves.

## Three-Layer Architecture

LexBuild separates concerns into three layers. Each layer depends only on the layer below it:

```
┌───────────────────────────────────────────────────────────────────────┐
│                        Applications & CLI                             │
│                                                                       │
│  @lexbuild/cli                         apps/astro                     │
│  ┌───────────┐  ┌───────────┐          ┌──────────────────────┐       │
│  │ download   │  │ convert   │          │ Astro SSR site       │      │
│  └─────┬─────┘  └─────┬─────┘          │ (consumes output     │       │
│        │               │                │  files, not packages) │     │
│        │               │                └──────────────────────┘      │
├────────┼───────────────┼──────────────────────────────────────────────┤
│        │          Source Packages                                     │
│        │               │                                              │
│        ▼               ▼                                              │
│  ┌──────────┐   ┌─────────────────────────────┐                       │
│  │  OLRC    │   │    Conversion Pipeline       │   (future:           │
│  │  Client  │   │                              │    @lexbuild/cfr,    │
│  └──────────┘   │  Collect → Render → Write    │    @lexbuild/state-*)│
│  (@lexbuild/    │                              │                      │
│    usc)         └──────────┬───────────────────┘                      │
│                            │                                          │
├────────────────────────────┼──────────────────────────────────────────┤
│                       Core Infrastructure                             │
│                            │                                          │
│       ┌────────────────────┼───────────────────────┐                  │
│       ▼                    ▼                       ▼                  │
│  ┌──────────┐     ┌───────────────┐     ┌───────────────────┐         │
│  │   XML    │     │     AST       │     │    Markdown       │         │
│  │  Parser  │     │   Builder     │     │    Renderer       │         │
│  │  (SAX)   │     │  (section     │     │  + Frontmatter    │         │
│  │          │     │   emit)       │     │  + Link Resolver  │         │
│  └──────────┘     └───────────────┘     └───────────────────┘         │
│  (@lexbuild/core)   (@lexbuild/core)       (@lexbuild/core)           │
└───────────────────────────────────────────────────────────────────────┘
```

### Layer 1: Core Infrastructure (`@lexbuild/core`)

The core package provides every building block needed to convert XML into Markdown. It is source-agnostic -- it understands XML structure and legislative document patterns, but not the specifics of any particular legal corpus.

Key modules:

- **XML Parser** -- streaming SAX parser (`saxes`) with namespace normalization. Elements in the default USLM namespace emit bare names; elements in other namespaces (XHTML, Dublin Core) emit prefixed names.
- **AST Builder** -- stack-based state machine that consumes SAX events and constructs a typed AST. Implements the emit-at-level pattern: completed subtrees are emitted via callback and released from memory.
- **Markdown Renderer** -- stateless, pure-function conversion from AST nodes to Markdown with YAML frontmatter, configurable notes filtering, and cross-reference link resolution.
- **Link Resolver** -- register/resolve/fallback system for converting USLM identifier URIs to relative Markdown links or OLRC website fallback URLs.

For a full walkthrough of how these modules connect, see [Conversion Pipeline](./conversion-pipeline.md). For the AST type system, see [AST Model](./ast-model.md). For the core package's API surface, see [Core Package Reference](../packages/core.md).

### Layer 2: Source Packages (`@lexbuild/usc`, future `@lexbuild/cfr`, etc.)

Each legal source gets its own package that orchestrates the pipeline for that source's XML format. Source packages depend on `@lexbuild/core` and are independent of each other.

A source package typically provides:

- A **converter** function that wires up the pipeline: create a read stream, configure the AST builder's `emitAt` level, collect emitted nodes, render them, and write output files.
- An optional **downloader** for fetching bulk data from the source's official website.
- Any source-specific post-processing (duplicate section detection, appendix handling, sidecar metadata generation).

The `@lexbuild/usc` package is the first and currently only source package. It converts U.S. Code XML (USLM 1.0 schema) into Markdown at three granularity levels and downloads XML from the Office of the Law Revision Counsel (OLRC). See [USC Package Reference](../packages/usc.md) for details.

The architecture is designed to grow horizontally. Adding a new source (e.g., Code of Federal Regulations, state statutes) means creating a new package that produces the same AST node types and feeds them to core's shared renderer. Output format remains consistent across all sources.

### Layer 3: Applications & CLI

The top layer contains user-facing tools that consume source packages:

- **`@lexbuild/cli`** -- command-line interface built with `commander`. Parses arguments, delegates to source packages, and provides user-facing output (`chalk`, `ora`, `cli-table3`). Contains no conversion logic. As new source packages are added, new commands are registered here.
- **`apps/astro`** -- an Astro-based web app that renders converted Markdown files with sidebar navigation, search, and dark mode. It has no code dependency on any LexBuild package; it consumes only the output files.

## Package Dependency Graph

```
@lexbuild/cli
  ├── @lexbuild/usc
  │     └── @lexbuild/core
  └── @lexbuild/core (direct dep for shared types)

apps/astro
  └── (no package deps — consumes output files only)
```

All internal dependencies use pnpm's `workspace:*` protocol. Turborepo resolves the build graph and builds in order: `core` first, then `usc`, then `cli`. All packages are versioned in lockstep using [Changesets](https://github.com/changesets/changesets).

## Repository Layout

```
lexbuild/
├── packages/
│   ├── core/        # @lexbuild/core — XML parsing, AST, Markdown rendering
│   ├── usc/         # @lexbuild/usc — U.S. Code converter and downloader
│   └── cli/         # @lexbuild/cli — CLI binary
├── apps/
│   └── astro/       # LexBuild web app
├── downloads/
│   └── usc/xml/     # Downloaded USC XML files (gitignored)
├── fixtures/
│   ├── fragments/   # Synthetic XML snippets for unit tests
│   └── expected/    # Expected output snapshots for integration tests
├── docs/            # This documentation
└── turbo.json       # Turborepo config
```
