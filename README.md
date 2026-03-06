# LexBuild

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcli?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/chris-c-thomas/lexbuild/ci.yml?style=for-the-badge&label=CI)](https://github.com/chris-c-thomas/lexbuild/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=for-the-badge)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=for-the-badge)](https://nodejs.org/)
[![license](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

A compiler for legal and civic texts. Converts disparate statutory data — starting with the [United States Code](https://uscode.house.gov/) — into structured Markdown optimized for AI ingestion, RAG pipelines, and semantic search.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Monorepo Architecture](#monorepo-architecture)
- [Packages](#packages)
- [Apps](#apps)
- [Install](#install)
- [Usage](#usage)
- [Output](#output)
- [Performance](#performance)
- [Development](#development)
- [Documentation](#documentation)
- [Data Sources](#data-sources)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The U.S. Code comprises 54 titles of federal statutory law. The [Office of the Law Revision Counsel](https://uscode.house.gov/about_office.xhtml) (OLRC) publishes the official text as [deeply nested XML](https://uscode.house.gov/download/download.shtml) using the [United States Legislative Markup](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf) (USLM) schema. These files are dense, laden with presentation markup, and difficult to work with directly.

LexBuild transforms this XML into per-section Markdown files with YAML frontmatter, predictable file paths, and content sized for typical embedding model context windows — making the entire U.S. Code accessible to LLMs, vector databases, and legal research tools.

The project is designed as an extensible platform. The U.S. Code is the first supported source, but the architecture is built to accommodate additional legal corpora — the Code of Federal Regulations, state statutes, and more — through new packages that share a common core.

---

## Features

- **Built-in downloader** — fetch individual titles or the entire U.S. Code directly from OLRC
- **Streaming SAX parser** — handles XML files of any size (100MB+) with bounded memory
- **Section-level output** — each section becomes its own Markdown file, sized for RAG chunk windows
- **Chapter-level output** — optional mode that inlines all sections into per-chapter files
- **YAML frontmatter** — structured metadata on every file (identifier, title, chapter, section, status, source credit)
- **Structural fidelity** — preserves the full USLM hierarchy using bold inline numbering that mirrors legal citation conventions
- **Cross-reference links** — resolved as relative links within the corpus, or as OLRC website URLs
- **Filterable notes** — editorial notes, statutory notes, and amendment history can be selectively included or excluded
- **Metadata indexes** — `_meta.json` sidecar files with section listings and token estimates
- **Tables** — XHTML tables and USLM layout tables converted to Markdown pipe tables
- **Dry-run mode** — preview conversion stats without writing files
- **Appendix handling** — titles with appendices (5, 11, 18, 28) output to separate directories

---

## Monorepo Architecture

LexBuild is a monorepo managed with [pnpm](https://pnpm.io/) workspaces and [Turborepo](https://turbo.build/). This structure cleanly separates concerns — shared parsing infrastructure, source-specific logic, CLI tooling, and downstream applications — while keeping everything in a single repository with unified versioning.

```
lexbuild/
├── packages/           # Shared libraries and tools
│   ├── core/           # @lexbuild/core — format-agnostic foundation
│   ├── usc/            # @lexbuild/usc — U.S. Code source package
│   └── cli/            # @lexbuild/cli — CLI binary (published to npm)
├── apps/               # Applications built on LexBuild output (planned)
├── fixtures/           # Test data
│   ├── fragments/      # Small synthetic XML snippets for unit tests
│   └── expected/       # Expected output snapshots for integration tests
├── docs/               # Architecture, format spec, extension guide
├── turbo.json          # Turborepo pipeline config
├── pnpm-workspace.yaml # Workspace definitions
└── CLAUDE.md           # AI-assisted development instructions
```

### Dependency Graph

```
@lexbuild/cli
  ├── @lexbuild/usc
  │     └── @lexbuild/core
  └── @lexbuild/core (direct dep for shared types)

Future packages (e.g., @lexbuild/cfr) follow the same pattern:
  @lexbuild/cfr
    └── @lexbuild/core
```

All internal dependencies use pnpm's `workspace:*` protocol, ensuring packages always resolve to the local version during development. [Changesets](https://github.com/changesets/changesets) manages versioning in lockstep across all packages — every release bumps all packages to the same version.

### Build Pipeline

Turborepo orchestrates the build, respecting the dependency graph:

1. `@lexbuild/core` builds first (no internal deps)
2. `@lexbuild/usc` builds next (depends on core)
3. `@lexbuild/cli` builds last (depends on both)

Tests run after builds; type-checking runs after upstream packages build; linting has no dependencies.

---

## Packages

### @lexbuild/core

**The format-agnostic foundation.** Core knows nothing about any specific legal source — it provides the infrastructure that all source packages build on.

| Capability | Description |
|------------|-------------|
| XML Parser | SAX streaming parser (`saxes`) with namespace normalization and typed event emitter |
| AST Types | Semantic tree representation — `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, and more |
| AST Builder | Stack-based tree construction with configurable emit level (section, chapter, etc.) |
| Markdown Renderer | Stateless AST-to-Markdown conversion with configurable note filtering and link styles |
| Frontmatter Generator | YAML frontmatter from structured metadata |
| Link Resolver | Cross-reference resolution with single-pass registration and fallback URLs |

**Key design**: The AST builder uses a **section-emit pattern** — when a section close tag is encountered, the completed subtree is emitted via callback and released from memory. This keeps memory bounded even for 100MB+ XML files.

**Dependencies**: `saxes`, `yaml`, `zod` (no internal deps)

### @lexbuild/usc

**U.S. Code source package.** Implements everything specific to USLM 1.0 XML from the OLRC.

| Capability | Description |
|------------|-------------|
| Converter | Orchestrates the full pipeline: XML stream, SAX parse, AST build, render, write |
| Downloader | Fetches individual or bulk title ZIP files from OLRC and extracts the XML |
| File Writer | Writes section/chapter `.md` files, `_meta.json` indexes, and `README.md` overviews |
| Title Metadata | Extracts Dublin Core metadata, release points, and positive law status |

**Dependencies**: `@lexbuild/core`, `yauzl` (ZIP extraction)

### @lexbuild/cli

**The published npm package.** Provides the `lexbuild` binary that end users install. Thin orchestration layer — all heavy lifting is delegated to `usc` and `core`.

| Command | Description |
|---------|-------------|
| `lexbuild download` | Fetch U.S. Code XML from OLRC |
| `lexbuild convert` | Convert XML to structured Markdown |

As new source packages are added, new commands will be registered here (e.g., `lexbuild download-cfr`, `lexbuild convert-cfr`).

**Dependencies**: `@lexbuild/core`, `@lexbuild/usc`, `commander`, `chalk`, `ora`, `cli-table3`, `pino`, `pino-pretty`

### Adding a New Source Package

The monorepo is designed to grow. Adding support for a new legal source (e.g., CFR, state statutes) follows a consistent pattern:

1. Create `packages/{source}/` with a dependency on `@lexbuild/core`
2. Implement a converter function analogous to `convertTitle()` in `@lexbuild/usc`
3. Reuse core's XML parser, AST types, Markdown renderer, and frontmatter generator
4. Add a new CLI command in `packages/cli`
5. Document the source's XML schema in the package README

See [docs/extending.md](docs/extending.md) for the full guide.

---

## Apps

The `apps/` directory is reserved for applications that showcase or build on top of the converted Markdown output. Planned applications include:

- **Web viewer** — Browse the converted U.S. Code with full-text search and cross-reference navigation
- **RAG demo** — Reference implementation of a legal Q&A system using LexBuild output with vector embeddings
- **MCP server** — Model Context Protocol server for AI-assisted legal research

Apps consume the output of LexBuild packages but are not published to npm. They live in the same monorepo for convenience and to serve as living documentation of how to integrate with the converted data.

---

## Install

### Run (no install needed)

You can run the CLI directly using `npx` or `pnpm dlx`

#### npx

```bash
npx @lexbuild/cli download --all
npx @lexbuild/cli convert --all
```

#### pnpm dlx

```bash
pnpm dlx @lexbuild/cli download --all
pnpm dlx @lexbuild/cli convert --all
```

### Global Install

Install the CLI globally using your preferred package manager.

#### npm

```bash
npm install -g @lexbuild/cli
```

#### pnpm

```bash
pnpm add -g @lexbuild/cli
```

### Build From Source

Requires [Node.js](https://nodejs.org/) >= 20
and [pnpm](https://pnpm.io/) >= 10.

#### Clone Repository

```bash
git clone https://github.com/chris-c-thomas/lexbuild.git
cd lexbuild
```

#### Install & Build

```bash
pnpm install
pnpm turbo build
```

---

## Usage

### Quick Start Examples

```bash
# Download and convert all 54 titles
lexbuild download --all && lexbuild convert --all

# Or start small — download and convert Title 1
lexbuild download --titles 1 && lexbuild convert --titles 1

# Download and convert a range
lexbuild download --titles 1-5 && lexbuild convert --titles 1-5
```

### Download Examples

Fetch U.S. Code XML files directly from the OLRC:

```bash
# Download a single title
lexbuild download --titles 1

# Download multiple titles (range)
lexbuild download --titles 1-5

# Download specific titles (mixed)
lexbuild download --titles 1-5,8,11

# Download all 54 titles (uses a single bulk zip)
lexbuild download --all

# Use a specific release point
lexbuild download --titles 26 --release-point 119-73not60
```

Or download manually from the [OLRC download page](https://uscode.house.gov/download/download.shtml).

### Convert Examples

```bash
# Convert all downloaded titles
lexbuild convert --all

# Convert a single XML file
lexbuild convert ./downloads/usc/xml/usc01.xml -o ./output

# Convert by title number
lexbuild convert --titles 1

# Convert multiple titles
lexbuild convert --titles 1-5,8,11

# Convert with a custom input directory
lexbuild convert --titles 1-5 -i ./my-xml-files

# Chapter-level output (one file per chapter)
lexbuild convert --titles 1 -o ./output -g chapter

# Cross-reference links resolved to OLRC URLs
lexbuild convert --titles 5 -o ./output --link-style canonical

# Include only amendment notes
lexbuild convert --titles 1 -o ./output --include-amendments

# Exclude all notes
lexbuild convert --titles 1 -o ./output --no-include-notes

# Dry run — preview stats without writing files
lexbuild convert --titles 42 --dry-run
```

### CLI Reference

```
lexbuild convert [input] [options]

Arguments:
  input                          Path to a USC XML file (optional if --titles
                                 or --all is used)

Options:
  --titles <spec>                Title(s) to convert: single (1), range (1-5),
                                 or mixed (1-5,8,11)
  --all                          Convert all downloaded titles found in
                                 --input-dir
  -i, --input-dir <dir>          Input directory for XML files
                                 (default: "./downloads/usc/xml")
  -o, --output <dir>             Output directory (default: "./output")
  -g, --granularity <level>      "section" or "chapter" (default: "section")
  --link-style <style>           "plaintext", "canonical", or "relative"
                                 (default: "plaintext")
  --no-include-source-credits    Exclude source credit annotations
  --no-include-notes             Exclude all notes
  --include-editorial-notes      Include editorial notes only
  --include-statutory-notes      Include statutory notes only
  --include-amendments           Include amendment history notes only
  --dry-run                      Parse and report without writing files
  -v, --verbose                  Enable verbose logging
  -h, --help                     Display help
```

```
lexbuild download [options]

Options:
  --titles <spec>                Title(s) to download: single (1), range (1-5),
                                 or mixed (1-5,8,11)
  --all                          Download all 54 titles
  -o, --output <dir>             Output directory
                                 (default: "./downloads/usc/xml")
  --release-point <point>        OLRC release point (default: current)
  -h, --help                     Display help
```

When multiple `--include-*-notes` flags are specified, they combine additively.

---

## Output

### Directory Structure

```
output/
  usc/
    title-01/
      README.md
      _meta.json
      chapter-01/
        _meta.json
        section-1.md
        section-2.md
        ...
      chapter-02/
        _meta.json
        section-101.md
        ...
```

Title directories are zero-padded (`title-01` through `title-54`). Chapter directories follow the same convention. Section files use the section number as-is, which may be alphanumeric (e.g., `section-106a.md`, `section-7801.md`).

### Markdown Structure

Each section file consists of YAML frontmatter followed by statutory text:

```yaml
---
identifier: "/us/usc/t1/s7"
title: "1 USC § 7 - Marriage"
title_number: 1
title_name: "GENERAL PROVISIONS"
section_number: "7"
section_name: "Marriage"
chapter_number: 1
chapter_name: "RULES OF CONSTRUCTION"
positive_law: true
currency: "119-73"
last_updated: "2025-12-03"
format_version: "1.0.0"
generator: "lexbuild@0.7.0"
source_credit: "(Added Pub. L. 104-199, § 3(a), Sept. 21, 1996, ...)"
---
```

```markdown
# § 7. Marriage

**(a)** For the purposes of any Federal law, rule, or regulation in which
marital status is a factor, an individual shall be considered married if...

**(b)** In this section, the term "State" means a State, the District of
Columbia, the Commonwealth of Puerto Rico, or any other territory...

---

**Source Credit**: (Added Pub. L. 104-199, § 3(a), Sept. 21, 1996, ...)
```

Subsections and below use bold inline numbering (`**(a)**`, `**(1)**`, `**(A)**`, `**(i)**`) rather than Markdown headings, preserving a flat document structure optimized for embedding models and chunking strategies.

### Metadata Indexes

Each directory includes a `_meta.json` sidecar file for programmatic access:

```json
{
  "format_version": "1.0.0",
  "identifier": "/us/usc/t5",
  "title_number": 5,
  "title_name": "Government Organization and Employees",
  "stats": {
    "chapter_count": 63,
    "section_count": 1162,
    "total_tokens_estimate": 2207855
  },
  "chapters": [
    {
      "identifier": "/us/usc/t5/ptI/ch1",
      "number": 1,
      "name": "Organization",
      "directory": "chapter-01",
      "sections": [
        {
          "identifier": "/us/usc/t5/s101",
          "number": "101",
          "name": "Executive departments",
          "file": "section-101.md",
          "token_estimate": 4200,
          "has_notes": true,
          "status": "current"
        }
      ]
    }
  ]
}
```

For the complete output format specification, see [docs/output-format.md](docs/output-format.md).

---

## Performance

The full U.S. Code — all 54 titles (53 with content; Title 53 is reserved), over 60,000 sections, ~85 million estimated tokens — converts in under 20 seconds on a modern machine. SAX streaming keeps memory bounded even for the largest titles:

| Title | XML Size | Sections | ~Tokens | Duration |
|-------|----------|----------|---------|----------|
| Title 1 - General Provisions | 0.3 MB | 39 | 35K | 0.04s |
| Title 10 - Armed Forces | 50.7 MB | 3,847 | 6.0M | 1.4s |
| Title 26 - Internal Revenue Code | 53.2 MB | 2,160 | 6.4M | 1.1s |
| Title 42 - Public Health | 107.3 MB | 8,460 | 14.7M | 2.7s |
| **All 54 titles** | **~650 MB** | **60,215** | **~85M** | **~18s** |

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10

### Getting Started

```bash
git clone https://github.com/chris-c-thomas/lexbuild.git
cd lexbuild
pnpm install
pnpm turbo build
```

### Common Commands

```bash
pnpm turbo build           # Build all packages (respects dependency order)
pnpm turbo test            # Run all tests
pnpm turbo lint            # Lint all packages
pnpm turbo typecheck       # Type-check all packages
pnpm turbo dev             # Watch mode (rebuild on change)
```

### Working on a Specific Package

```bash
# Build only core
pnpm turbo build --filter=@lexbuild/core

# Test only usc
pnpm turbo test --filter=@lexbuild/usc

# Run the CLI locally during development
node packages/cli/dist/index.js download --titles 1
node packages/cli/dist/index.js convert --titles 1
```

### Versioning and Releases

LexBuild uses [Changesets](https://github.com/changesets/changesets) for version management. All packages are versioned in lockstep.

```bash
pnpm changeset             # Create a changeset for your changes
pnpm version-packages      # Apply changesets and bump versions
pnpm release               # Build and publish all packages to npm
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Output Format](docs/output-format.md) | Directory layout, frontmatter schema, metadata indexes, RAG guidance |
| [Architecture](docs/architecture.md) | System overview, package design, data flow, memory profile |
| [XML Element Reference](docs/xml-element-reference.md) | USLM element mapping and Markdown output |
| [Extending](docs/extending.md) | Guide for adding new legal source types |

---

## Data Sources

LexBuild processes XML published by the [Office of the Law Revision Counsel](https://uscode.house.gov/) (OLRC) of the U.S. House of Representatives. The XML uses the United States Legislative Markup (USLM) 1.0 schema.

The U.S. Code XML is **public domain** and freely available at [uscode.house.gov/download/download.shtml](https://uscode.house.gov/download/download.shtml).

---

## Roadmap

Features and enhancements that are currently planned.

Feel free to open an [issue](https://github.com/chris-c-thomas/lexbuild/issues) or start a [discussion](https://github.com/chris-c-thomas/lexbuild/discussions) to talk about any of these. Ideas and contributions are always welcome.

**Output**

- [ ] Additional output formats — plain text, JSON, and JSONL
- [ ] Precise token counting via `tiktoken` (`--precise-tokens`)
- [ ] Section diff between OLRC release points

**Sources**

- [ ] Code of Federal Regulations (CFR) — `@lexbuild/cfr`
- [ ] State statutes — `@lexbuild/state-{abbr}`
- [ ] Incremental update support for new OLRC release points

**Metadata**

- [ ] Parent path metadata — full structural ancestry per section
- [ ] Related sections — sibling references for contextual RAG retrieval
- [ ] Cross-reference graph export (JSON/GraphML)

**Tooling**

- [ ] MCP server for AI-assisted legal research
- [ ] Embedding pipeline integration

**Apps**

- [ ] Web viewer for browsing converted output
- [ ] RAG demo application with vector search
- [ ] API server for programmatic access to converted data

---

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code conventions, testing guidelines, and the PR checklist.

---

## License

[MIT](LICENSE)
