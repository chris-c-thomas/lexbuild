---
title: Architecture Overview
description: LexBuild's monorepo structure, three-layer dependency model, and end-to-end data flow from XML source to Markdown output.
order: 1
---

LexBuild is a TypeScript monorepo that converts U.S. legal XML into structured Markdown optimized for AI and RAG ingestion. It currently supports three federal sources: the U.S. Code (USLM schema), the eCFR (GPO/SGML-derived XML), and the Federal Register (GPO/SGML via the FederalRegister.gov API). The architecture is designed to grow horizontally as new sources are added.

## Monorepo Structure

The repository is organized into packages and applications:

| Package / App | Name | Role |
|---|---|---|
| `packages/core` | `@lexbuild/core` | XML parsing, AST types, Markdown rendering, frontmatter, link resolution, resilient file I/O |
| `packages/usc` | `@lexbuild/usc` | U.S. Code converter and downloader |
| `packages/ecfr` | `@lexbuild/ecfr` | eCFR (Code of Federal Regulations) converter and downloader |
| `packages/fr` | `@lexbuild/fr` | Federal Register converter and downloader |
| `packages/cli` | `@lexbuild/cli` | CLI binary with `download-*` and `convert-*` commands |
| `apps/astro` | LexBuild web app | Astro 6 SSR site for browsing converted content |
| `apps/api` | `@lexbuild/api` | Data API (Hono, SQLite, Meilisearch) for programmatic access |

All packages use pnpm workspaces with `workspace:*` protocol for internal dependencies. Turborepo builds them in topological order and all published packages use lockstep versioning via Changesets.

## Three-Layer Architecture

The system is arranged in three dependency layers. Each layer depends only on the layer below it.

```
Layer 3: Applications & CLI
  @lexbuild/cli          apps/astro         apps/api
  (orchestrates          (serves output     (serves content
   source packages)       files, no code     from SQLite)
                          dependency)

Layer 2: Source Packages
  @lexbuild/usc          @lexbuild/ecfr     @lexbuild/fr
  (USLM XML)             (GPO/SGML XML)     (GPO/SGML XML)

Layer 1: Core Infrastructure
  @lexbuild/core
  (XML parser, AST, renderer, frontmatter, links, file I/O)
```

### Layer 1: Core Infrastructure

`@lexbuild/core` is the source-agnostic foundation that every other package depends on. It provides:

- **XML Parser** -- A streaming SAX parser built on saxes with namespace normalization. Handles documents exceeding 100 MB without loading them into memory.
- **AST Builder** -- A stack-based state machine that converts SAX events into LexBuild AST nodes. The USLM builder (for U.S. Code XML) lives in core. Source packages with different XML formats implement their own builders.
- **Markdown Renderer** -- A stateless, pure-function pipeline that transforms AST nodes into Markdown text. It operates on AST types, not XML elements, so it works identically for all sources.
- **Frontmatter Generator** -- Produces YAML frontmatter with a `source` discriminator and `legal_status` field on every output file.
- **Link Resolver** -- A register/resolve/fallback system for cross-references across USC, CFR, and FR identifier schemes.
- **Resilient File I/O** -- `writeFile` and `mkdir` wrappers that retry on file descriptor exhaustion errors with exponential backoff.

### Layer 2: Source Packages

Each legal source format has its own package. Source packages depend on `@lexbuild/core` and provide:

- A source-specific AST builder (when the XML format differs from USLM)
- A converter function using the collect-then-write pattern
- An optional downloader for fetching bulk data
- Source-specific post-processing (identifier construction, deduplication, hierarchy inference)

| Package | Source | XML Format | AST Builder |
|---|---|---|---|
| `@lexbuild/usc` | U.S. Code (OLRC) | USLM 1.0 (namespaced, hierarchical) | Core's `ASTBuilder` |
| `@lexbuild/ecfr` | eCFR (ecfr.gov / govinfo) | GPO/SGML (DIV-based, no namespaces) | Own `EcfrASTBuilder` |
| `@lexbuild/fr` | Federal Register | GPO/SGML (document-centric, flat) | Own `FrASTBuilder` |

New sources produce the same AST node types and feed them to core's shared renderer, keeping output format consistent across all legal corpora.

### Layer 3: Applications and CLI

The top layer contains user-facing interfaces. Neither the CLI nor the applications contain conversion logic.

- **`@lexbuild/cli`** -- Command-line interface built with commander. Provides commands following the `{action}-{source}` naming pattern (`download-usc`, `convert-usc`, `download-ecfr`, `convert-ecfr`, `download-fr`, `convert-fr`). All conversion work is delegated to source packages.
- **`apps/astro`** -- Astro 6 SSR web application at lexbuild.dev. Provides a browsable interface with full-text search via Meilisearch. Has no code dependency on any `@lexbuild/*` package -- it consumes output Markdown files and `_meta.json` sidecar indexes directly from the filesystem.
- **`apps/api`** -- Hono REST API at lexbuild.dev/api. Provides programmatic access to the corpus from a SQLite database. Depends on `@lexbuild/core` for shared types but has no dependency on source packages.

## Package Boundary Enforcement

Source packages are strictly independent. They depend only on `@lexbuild/core` and never import from each other. This constraint is enforced at two levels:

1. **pnpm workspaces** -- Source packages declare only `@lexbuild/core` as a workspace dependency.
2. **ESLint `no-restricted-imports`** -- Rules in `eslint.config.js` prevent source packages from importing each other. A build-time lint failure catches any accidental cross-source import.

This independence ensures that adding or modifying one source cannot break another. The CLI is the only package that depends on multiple source packages.

## End-to-End Data Flow

Every conversion follows the same four-stage pipeline, regardless of source:

```
XML source  -->  SAX parse  -->  AST build  -->  Markdown render  -->  file output
(streaming)      (core)          (source-        (core)                (source-
                                  specific)                            specific paths)
```

1. **SAX parsing** -- Core's `XMLParser` streams the XML file through saxes, emitting typed events (`openElement`, `closeElement`, `text`).
2. **AST building** -- A source-specific builder consumes parser events and produces shared AST node types (`LevelNode`, `ContentNode`, `InlineNode`, etc.).
3. **Markdown rendering** -- Core's renderer converts AST nodes to Markdown strings with YAML frontmatter and resolved cross-reference links.
4. **File output** -- The source converter writes Markdown files, `_meta.json` sidecar indexes, and `README.md` files to the output directory using core's resilient file I/O wrappers.

For a deeper look at each stage, see the [Conversion Pipeline](/docs/architecture/conversion-pipeline) page.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js >= 22 LTS (ESM) |
| Language | TypeScript 5.x, strict mode |
| XML parsing | saxes (SAX streaming) |
| CLI framework | commander |
| Testing | Vitest |
| Build | tsup |
| Monorepo | Turborepo + pnpm workspaces |
| Versioning | Changesets (lockstep) |
| Linting | ESLint + @typescript-eslint |
| Formatting | Prettier |

The web application uses Astro 6 with SSR and Meilisearch for search. The data API uses Hono with SQLite (better-sqlite3) and Meilisearch.
