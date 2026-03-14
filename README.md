# LexBuild

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcli?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/chris-c-thomas/LexBuild/ci.yml?style=for-the-badge&label=CI)](https://github.com/chris-c-thomas/LexBuild/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=for-the-badge)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=for-the-badge)](https://nodejs.org/)
[![license](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

LexBuild is an open-source toolchain for U.S. legal texts. It transforms official source data into structured Markdown with rich metadata, optimized for LLMs, RAG pipelines, and semantic search.

It currently handles the [U.S. Code](https://uscode.house.gov/) and the [Code of Federal Regulations](https://www.ecfr.gov/)

## Table of Contents

- [Overview](#overview)
- [Supported Sources](#supported-sources)
- [Features](#features)
- [Monorepo](#monorepo)
- [Packages](#packages)
- [Apps](#apps)
- [Install](#install)
- [Usage](#usage)
- [Output](#output)
- [Performance](#performance)
- [Development](#development)
- [Data Sources](#data-sources)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The U.S. Code comprises 54 titles of federal statutory law published by the [Office of the Law Revision Counsel](https://uscode.house.gov/about_office.xhtml) (OLRC) as [USLM XML](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf). The Code of Federal Regulations (CFR) comprises 50 titles of federal regulations published by the [Office of the Federal Register](https://www.ecfr.gov/) as GPO/SGML-derived XML via [govinfo](https://www.govinfo.gov/bulkdata/ECFR). Both formats are dense, deeply nested, and difficult to work with directly.

LexBuild transforms this XML into per-section Markdown files with YAML frontmatter, predictable file paths, and content sized for typical embedding model context windows, making the full corpus of federal law and regulations accessible to LLMs, vector databases, and legal research tools.

The project is designed as an extensible multi-source platform. Each source gets its own package with a source-specific AST builder, while sharing a common core for XML parsing, AST types, Markdown rendering, and frontmatter generation. Adding a new source means writing a new builder — the rendering pipeline is free.

---

## Supported Sources

| Source | Package | XML Format | Titles | Status |
|--------|---------|------------|--------|--------|
| U.S. Code | [`@lexbuild/usc`](packages/usc/) | USLM 1.0 | 54 | Stable |
| eCFR (Code of Federal Regulations) | [`@lexbuild/ecfr`](packages/ecfr/) | GPO/SGML | 50 | Stable |
| Annual CFR (official edition) | `@lexbuild/cfr` | GPO/SGML | 50 | Planned |
| Federal Register | `@lexbuild/fr` | GPO/SGML variant | — | Planned |
| State statutes | `@lexbuild/state-*` | Varies | — | Exploratory |

---

## Features

### Shared

- **Streaming SAX parser** — handles XML files of any size (100MB+) with bounded memory
- **Multi-source architecture** — each source has its own AST builder, sharing a common rendering pipeline
- **YAML frontmatter** — structured metadata on every file (`source`, `legal_status`, identifier, hierarchy, status)
- **Metadata indexes** — `_meta.json` sidecar files with section listings and token estimates
- **Cross-reference links** — resolved as relative links within the corpus, or as source website URLs
- **Filterable notes** — editorial notes, statutory notes, and amendment history can be selectively included or excluded
- **Dry-run mode** — preview conversion stats without writing files
- **Multiple granularities** — section-level, chapter/part-level, or full title as a single file

### U.S. Code

- **Built-in downloader** — fetch individual titles or the entire U.S. Code directly from OLRC
- **Section-level output** — each section becomes its own Markdown file, sized for RAG chunk windows
- **Chapter and title modes** — optional coarser granularity for different use cases
- **Structural fidelity** — preserves the full USLM hierarchy using bold inline numbering
- **Tables** — XHTML tables and USLM layout tables converted to Markdown pipe tables
- **Appendix handling** — titles with appendices (5, 11, 18, 28) output to separate directories
- **Duplicate section disambiguation** — sections with duplicate numbers within a chapter get `-2`, `-3` suffixes

### eCFR

- **Built-in downloader** — fetch individual titles or all 50 titles from govinfo bulk data
- **Part-based granularity** — section, part, or title output modes (part is the CFR equivalent of USC chapter)
- **Authority and source tracking** — part-level AUTH and SOURCE citations extracted to frontmatter
- **HTML table support** — HTML-style tables (TABLE/TR/TH/TD) converted to Markdown pipe tables
- **Legal status metadata** — all eCFR output marked as `authoritative_unofficial`

---

## Monorepo

LexBuild is a monorepo managed with [pnpm](https://pnpm.io/) workspaces and [Turborepo](https://turbo.build/). This structure cleanly separates concerns — shared parsing infrastructure, source-specific logic, CLI tooling, and downstream applications — while keeping everything in a single repository with unified versioning.

```
lexbuild/
├── packages/
│   ├── core/           # @lexbuild/core — format-agnostic foundation
│   ├── usc/            # @lexbuild/usc — U.S. Code source package
│   ├── ecfr/           # @lexbuild/ecfr — eCFR source package
│   └── cli/            # @lexbuild/cli — CLI binary (published to npm)
├── apps/
│   └── web/            # LexBuild web app
├── fixtures/
│   ├── fragments/      # Small synthetic XML snippets for unit tests
│   │   ├── usc/        # USLM fixtures
│   │   └── ecfr/       # GPO/SGML fixtures
│   └── expected/       # Expected output snapshots for integration tests
├── docs/               # Architecture, format spec, extension guide
├── turbo.json          # Turborepo config
└── pnpm-workspace.yaml # Workspace definitions
```

### Dependency Graph

```
@lexbuild/cli
  ├── @lexbuild/usc
  │     └── @lexbuild/core
  ├── @lexbuild/ecfr
  │     └── @lexbuild/core
  └── @lexbuild/core (direct dep for shared types)
```

Source packages are independent of each other. `@lexbuild/usc` and `@lexbuild/ecfr` never import from each other — they only depend on core. Future source packages follow the same pattern.

All internal dependencies use pnpm's `workspace:*` protocol. [Changesets](https://github.com/changesets/changesets) manages versioning in lockstep across all packages — every release bumps all packages to the same version.

### Build Pipeline

Turborepo orchestrates the build, respecting the dependency graph:

1. `@lexbuild/core` builds first (no internal deps)
2. `@lexbuild/usc` and `@lexbuild/ecfr` build next (depend on core, independent of each other)
3. `@lexbuild/cli` builds last (depends on all three)

Tests run after builds; type-checking runs after upstream packages build; linting has no dependencies.

---

## Packages

### @lexbuild/core

**The format-agnostic foundation.** Core knows nothing about any specific legal source — it provides the infrastructure that all source packages build on.

| Capability | Description |
|------------|-------------|
| XML Parser | SAX streaming parser (`saxes`) with namespace normalization and typed event emitter |
| AST Types | Semantic tree representation — `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, and more |
| USLM AST Builder | Stack-based tree construction with configurable emit level (section, chapter, etc.) for USLM XML |
| Markdown Renderer | Stateless AST-to-Markdown conversion with configurable note filtering and link styles |
| Frontmatter Generator | YAML frontmatter from structured metadata with `source` and `legal_status` fields |
| Link Resolver | Cross-reference resolution with single-pass registration and fallback URLs for both USC and CFR identifiers |

**Key design**: The AST builder uses a **section-emit pattern** — when a section close tag is encountered, the completed subtree is emitted via callback and released from memory. This keeps memory bounded even for 100MB+ XML files. Source packages for non-USLM formats (like eCFR) implement their own builders following the same pattern.

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

### @lexbuild/ecfr

**eCFR source package.** Implements everything specific to the GPO/SGML-derived XML from govinfo's eCFR bulk data.

| Capability | Description |
|------------|-------------|
| eCFR AST Builder | Stack-based SAX → AST construction for GPO/SGML XML (DIV-based hierarchy, E emphasis codes) |
| Converter | Full pipeline with section/part/title granularity, `_meta.json`, and `README.md` generation |
| Downloader | Fetches individual title XML files from govinfo (no ZIP — plain XML per title) |
| Element Classification | Complete mapping of 60+ GPO/SGML elements to LexBuild AST node types |

The eCFR XML uses a completely different format from USLM — numbered `DIV1`–`DIV9` elements with `TYPE` attributes instead of semantic element names, flat `<P>` elements instead of nested subsections, `<E T="xx">` emphasis codes instead of `<b>`/`<i>`, and HTML-style tables instead of XHTML namespace tables.

**Dependencies**: `@lexbuild/core` (no dependency on `@lexbuild/usc`)

### @lexbuild/cli

**The published npm package.** Provides the `lexbuild` binary that end users install. Thin orchestration layer — all heavy lifting is delegated to the source packages and core.

| Command | Description |
|---------|-------------|
| `lexbuild download-usc` | Fetch U.S. Code XML from OLRC |
| `lexbuild convert-usc` | Convert USC XML to structured Markdown |
| `lexbuild download-ecfr` | Fetch eCFR XML from govinfo |
| `lexbuild convert-ecfr` | Convert eCFR XML to structured Markdown |

**Dependencies**: `@lexbuild/core`, `@lexbuild/usc`, `@lexbuild/ecfr`, `commander`, `chalk`, `ora`, `cli-table3`

### Adding a New Source Package

The monorepo is designed to grow. Adding support for a new legal source follows an established pattern:

1. Create `packages/{source}/` with a dependency on `@lexbuild/core`
2. Implement a source-specific AST builder (SAX events → LexBuild AST nodes)
3. Implement a converter function analogous to `convertTitle()` or `convertEcfrTitle()`
4. Reuse core's XML parser, AST types, Markdown renderer, and frontmatter generator
5. Add download and convert commands in `packages/cli`
6. Add the package to the `fixed` array in `.changeset/config.json`

---

## Apps

### Web

A server-rendered documentation site for browsing the U.S. Code as structured Markdown. Built with Next.js 16, TypeScript, React 19, Tailwind CSS 4, Shiki, and shadcn/ui.

- **60,000+ section pages** served via SSR with CDN caching (1-year `s-maxage`)
- **Three granularity levels** — view any title, chapter, or section with Markdown source and rendered HTML preview
- **Sidebar navigation** — lazy-loaded per-title JSON, virtualized section lists for large chapters
- **Full-text search** — Pagefind-powered Cmd+K search across all sections
- **Dark mode** — class-based theme toggle with system preference detection
- **SEO** — unique `<title>`, Open Graph metadata, sitemap with 63k+ URLs

The site consumes LexBuild's *output* (`.md` files and `_meta.json` sidecars), not its code so it has no dependency on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/cli`.

See [apps/web/README.md](apps/web/README.md) for setup and development instructions.

---

## Install

### Run (no install needed)

You can run the CLI directly using `npx` or `pnpm dlx`

#### npx

```bash
npx @lexbuild/cli download-usc --all
npx @lexbuild/cli convert-usc --all
```

#### pnpm dlx

```bash
pnpm dlx @lexbuild/cli download-usc --all
pnpm dlx @lexbuild/cli convert-usc --all
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

Requires [Node.js](https://nodejs.org/) >= 22
and [pnpm](https://pnpm.io/) >= 10.

#### Clone Repository

```bash
git clone https://github.com/chris-c-thomas/LexBuild.git
cd LexBuild
```

#### Install & Build

```bash
pnpm install
pnpm turbo build
```

---

## Usage

### U.S. Code

```bash
# Download and convert all 54 titles
lexbuild download-usc --all && lexbuild convert-usc --all

# Start small — download and convert Title 1
lexbuild download-usc --titles 1 && lexbuild convert-usc --titles 1

# Download and convert a range
lexbuild download-usc --titles 1-5 && lexbuild convert-usc --titles 1-5

# Chapter-level output (one file per chapter)
lexbuild convert-usc --titles 1 -g chapter

# Title-level output (one file per title)
lexbuild convert-usc --titles 26 -g title

# Cross-reference links resolved to OLRC URLs
lexbuild convert-usc --titles 5 --link-style canonical

# Include only amendment notes
lexbuild convert-usc --titles 1 --include-amendments

# Dry run — preview stats without writing files
lexbuild convert-usc --titles 42 --dry-run
```

### eCFR (Code of Federal Regulations)

```bash
# Download and convert all 50 titles
lexbuild download-ecfr --all && lexbuild convert-ecfr --all

# Download and convert a single title
lexbuild download-ecfr --titles 17 && lexbuild convert-ecfr --titles 17

# Convert a range of titles
lexbuild download-ecfr --titles 1-5 && lexbuild convert-ecfr --titles 1-5

# Part-level output (one file per part — CFR equivalent of chapter)
lexbuild convert-ecfr --titles 17 -g part

# Convert a specific XML file
lexbuild convert-ecfr ./downloads/ecfr/xml/ECFR-title17.xml -o ./output

# Dry run — preview stats without writing files
lexbuild convert-ecfr --all --dry-run
```

### CLI Reference

#### `lexbuild download-usc [options]`

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s) to download: `1`, `1-5`, or `1-5,8,11` |
| `--all` | — | Download all 54 titles (single bulk zip) |
| `-o, --output <dir>` | `./downloads/usc/xml` | Download directory |
| `--release-point <id>` | latest bundled (e.g. `119-73not60`) | OLRC release point identifier |

#### `lexbuild convert-usc [options] [input]`

Specify input as a file path, `--titles`, or `--all` (exactly one).

| Option | Default | Description |
|--------|---------|-------------|
| `[input]` | — | Path to a USC XML file |
| `--titles <spec>` | — | Title(s) to convert: `1`, `1-5`, or `1-5,8,11` |
| `--all` | — | Convert all downloaded titles in `--input-dir` |
| `-o, --output <dir>` | `./output` | Output directory |
| `-i, --input-dir <dir>` | `./downloads/usc/xml` | Input directory for XML files |
| `-g, --granularity <level>` | `section` | `section`, `chapter`, or `title` |
| `--link-style <style>` | `plaintext` | `plaintext`, `canonical`, or `relative` |
| `--no-include-source-credits` | — | Exclude source credit annotations |
| `--no-include-notes` | — | Exclude all notes |
| `--include-editorial-notes` | — | Include editorial notes only |
| `--include-statutory-notes` | — | Include statutory notes only |
| `--include-amendments` | — | Include amendment history notes only |
| `--dry-run` | — | Parse and report without writing files |
| `-v, --verbose` | — | Enable verbose logging |

#### `lexbuild download-ecfr [options]`

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s) to download: `1`, `1-5`, or `1-5,17` |
| `--all` | — | Download all 50 titles |
| `-o, --output <dir>` | `./downloads/ecfr/xml` | Download directory |

#### `lexbuild convert-ecfr [options] [input]`

Specify input as a file path, `--titles`, or `--all` (exactly one).

| Option | Default | Description |
|--------|---------|-------------|
| `[input]` | — | Path to an eCFR XML file |
| `--titles <spec>` | — | Title(s) to convert: `1`, `1-5`, or `1-5,17` |
| `--all` | — | Convert all downloaded titles in `--input-dir` |
| `-o, --output <dir>` | `./output` | Output directory |
| `-i, --input-dir <dir>` | `./downloads/ecfr/xml` | Input directory for XML files |
| `-g, --granularity <level>` | `section` | `section`, `part`, or `title` |
| `--link-style <style>` | `plaintext` | `plaintext`, `canonical`, or `relative` |
| `--no-include-source-credits` | — | Exclude source credit annotations |
| `--no-include-notes` | — | Exclude all notes |
| `--include-editorial-notes` | — | Include editorial notes only |
| `--include-statutory-notes` | — | Include statutory/regulatory notes only |
| `--include-amendments` | — | Include amendment notes only |
| `--dry-run` | — | Parse and report without writing files |
| `-v, --verbose` | — | Enable verbose logging |

---

## Output

### U.S. Code

**Section granularity** (default):

```
output/usc/
  title-01/
    README.md
    _meta.json
    chapter-01/
      _meta.json
      section-1.md
      section-2.md
    chapter-02/
      _meta.json
      section-101.md
```

**Chapter granularity** (`-g chapter`):

```
output/usc/
  title-01/
    README.md
    _meta.json
    chapter-01/
      chapter-01.md
```

**Title granularity** (`-g title`):

```
output/usc/
  title-01.md
```

### eCFR

**Section granularity** (default):

```
output/ecfr/
  title-17/
    README.md
    _meta.json
    chapter-IV/
      part-240/
        _meta.json
        section-240.10b-5.md
        section-240.10b-18.md
      part-249/
        _meta.json
        section-249.220f.md
```

**Part granularity** (`-g part`):

```
output/ecfr/
  title-17/
    chapter-IV/
      part-240.md
```

**Title granularity** (`-g title`):

```
output/ecfr/
  title-17.md
```

### Frontmatter

Every Markdown file includes YAML frontmatter with source-specific metadata:

**U.S. Code:**

```yaml
---
identifier: "/us/usc/t1/s7"
source: "usc"
legal_status: "official_legal_evidence"
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
format_version: "1.1.0"
generator: "lexbuild@1.8.0"
source_credit: "(Added Pub. L. 104-199, § 3(a), Sept. 21, 1996, ...)"
---
```

**eCFR:**

```yaml
---
identifier: "/us/cfr/t17/s240.10b-5"
source: "ecfr"
legal_status: "authoritative_unofficial"
title: "17 CFR § 240.10b-5 - Employment of manipulative and deceptive devices"
title_number: 17
title_name: "Commodity and Securities Exchanges"
section_number: "240.10b-5"
section_name: "Employment of manipulative and deceptive devices"
part_number: "240"
part_name: "GENERAL RULES AND REGULATIONS, SECURITIES EXCHANGE ACT OF 1934"
positive_law: false
currency: "2025-03-13"
last_updated: "2025-03-13"
format_version: "1.1.0"
generator: "lexbuild@1.8.0"
authority: "15 U.S.C. 78a et seq., ..."
cfr_part: "240"
---
```

The `source` field discriminates content origin (`"usc"` or `"ecfr"`). The `legal_status` field indicates provenance: `"official_legal_evidence"` (positive law USC titles), `"official_prima_facie"` (non-positive law USC titles), or `"authoritative_unofficial"` (eCFR).

### Metadata Indexes

Each directory includes a `_meta.json` sidecar file for programmatic access:

```json
{
  "format_version": "1.1.0",
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

- [Node.js](https://nodejs.org/) >= 22
- [pnpm](https://pnpm.io/) >= 10

### Getting Started

```bash
git clone https://github.com/chris-c-thomas/LexBuild.git
cd LexBuild
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

# Test only ecfr
pnpm turbo test --filter=@lexbuild/ecfr

# Run the CLI locally during development
node packages/cli/dist/index.js convert --titles 1
node packages/cli/dist/index.js convert-ecfr --titles 17
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

## Data Sources

LexBuild processes XML from two official U.S. government sources:

| Source | Publisher | Format | URL |
|--------|-----------|--------|-----|
| U.S. Code | Office of the Law Revision Counsel (OLRC) | USLM 1.0 XML | [uscode.house.gov/download](https://uscode.house.gov/download/download.shtml) |
| eCFR | Office of the Federal Register via govinfo | GPO/SGML XML | [govinfo.gov/bulkdata/ECFR](https://www.govinfo.gov/bulkdata/ECFR) |

Both datasets are **public domain** and freely available.

---

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code conventions, testing guidelines, and the PR checklist.

---

## License

[MIT](LICENSE)
