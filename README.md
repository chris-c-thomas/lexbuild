# LexBuild

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcli?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/chris-c-thomas/LexBuild/ci.yml?style=for-the-badge&label=CI)](https://github.com/chris-c-thomas/LexBuild/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=for-the-badge)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=for-the-badge)](https://nodejs.org/)
[![license](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

LexBuild is an open-source toolchain for U.S. legal texts. Its extensible architecture transforms official source data into structured Markdown with rich metadata, optimized for LLMs, RAG pipelines, and semantic search.

## Table of Contents

- [Overview](#overview)
- [Sources](#sources)
- [Monorepo](#monorepo)
- [Packages](#packages)
- [Apps](#apps)
- [Install](#install)
- [Usage](#usage)
- [Output](#output)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The [United States Code](https://uscode.house.gov/) (U.S. Code) is the official codification of federal statutory law, organized into 54 titles. It is available as [USLM-derived XML](https://github.com/usgpo/uslm) provided by the [Office of the Law Revision Counsel](https://uscode.house.gov/about_office.xhtml) (OLRC).

The [Code of Federal Regulations](https://www.govinfo.gov/app/collection/cfr/) (CFR) is the official codification of federal administrative regulations, organized into 50 titles. Each title is revised once per year and published on a staggered quarterly schedule. The [Electronic Code of Federal Regulations](https://www.ecfr.gov/) (eCFR) serves as a continuously updated editorial compilation of the CFR, incorporating regulatory changes as they appear in the  [Federal Register](https://www.federalregister.gov/). The eCFR is available as [GPO/SGML-derived XML](https://www.govinfo.gov/bulkdata/ECFR) through [GovInfo](https://www.govinfo.gov)

Both formats are dense and deeply nested, often making them difficult to work with directly.

LexBuild transforms this XML into per-section Markdown files with YAML frontmatter, predictable file paths, and content sized for typical embedding model context windows, making the full corpus of federal law and regulations accessible to LLMs, vector databases, and legal research tools.

The project is designed as an extensible multi-source platform. Each source gets its own package with a source-specific AST builder and shares a common core for XML parsing, AST types, Markdown rendering, and frontmatter generation.

---

## Sources

| Source | Package | XML Format | Titles | Status |
|--------|---------|------------|--------|--------|
| U.S. Code | [`@lexbuild/usc`](packages/usc/) | USLM 1.0 | 54 | Stable |
| eCFR (Code of Federal Regulations) | [`@lexbuild/ecfr`](packages/ecfr/) | GPO/SGML | 50 | Stable |
| Annual CFR (official edition) | `@lexbuild/cfr` | GPO/SGML | 50 | Planned |
| Federal Register | `@lexbuild/fr` | GPO/SGML variant | — | Planned |
| State statutes | `@lexbuild/state-*` | Varies | — | Exploratory |

---

## Monorepo

LexBuild is a monorepo managed with [pnpm](https://pnpm.io/) workspaces and [Turborepo](https://turbo.build/). This structure cleanly separates concerns such as shared parsing infrastructure, source-specific logic, CLI tooling, and downstream applications, all while keeping everything in a single repository with unified versioning.

```
lexbuild/
├── packages/
│   ├── core/           # @lexbuild/core — format-agnostic foundation
│   ├── usc/            # @lexbuild/usc — U.S. Code source package
│   ├── ecfr/           # @lexbuild/ecfr — eCFR source package
│   └── cli/            # @lexbuild/cli — CLI binary
├── apps/
│   └── web/            # LexBuild web app
├── fixtures/
│   ├── fragments/      # Small synthetic XML snippets for unit tests
│   │   ├── usc/        # USLM fixtures
│   │   └── ecfr/       # GPO/SGML fixtures
│   └── expected/       # Expected output snapshots for integration tests
├── docs/               # Full Documentation
├── turbo.json          # Turborepo config
└── pnpm-workspace.yaml # pnpm workspace config
```

### Dependency Graph

```
@lexbuild/cli
  ├── @lexbuild/usc
  │     └── @lexbuild/core
  ├── @lexbuild/ecfr
  │     └── @lexbuild/core
  └── @lexbuild/core
```

Source packages are independent of each other. `@lexbuild/usc` and `@lexbuild/ecfr` never import from each other as they only depend `@lexbuild/core`. Future source packages will follow the same pattern.

All internal dependencies use pnpm's `workspace:*` protocol.

[Changesets](https://github.com/changesets/changesets) manages versioning in lockstep across all packages.

### Build Pipeline

Turborepo orchestrates the build, respecting the dependency graph:

1. `@lexbuild/core` builds first
2. `@lexbuild/usc` and `@lexbuild/ecfr` build next
3. `@lexbuild/cli` builds last

Tests run after builds, type-checking runs after upstream packages build, and linting has no dependencies.

---

## Packages

### @lexbuild/core

Implements the base infrastructure that all other source packages build on.

| Capability | Description |
|------------|-------------|
| XML Parser | Streaming SAX parser (`saxes`) — handles XML files of any size (100MB+) with bounded memory |
| AST Types | Semantic tree representation — `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, and more |
| USLM AST Builder | Stack-based tree construction with configurable emit level (section, chapter, etc.) for USLM XML |
| Markdown Renderer | Stateless AST-to-Markdown conversion with configurable note filtering and link styles |
| Frontmatter Generator | YAML frontmatter with structured metadata (`source`, `legal_status`, identifier, hierarchy, status) |
| Link Resolver | Cross-reference resolution with single-pass registration and fallback URLs for both USC and CFR identifiers |

Each source package produces the same AST node types, so it gets Markdown rendering, frontmatter generation, cross-reference resolution, note filtering, multiple granularities, and dry-run mode for free.

The AST builder uses a section-emit pattern. When a section close tag is encountered, the completed subtree is emitted via callback and released from memory. Source packages for non-USLM formats (like eCFR) implement their own builders following the same pattern.

**Dependencies**: `saxes`, `yaml`, `zod`

### @lexbuild/usc

Implements everything specific to USLM 1.0 XML from the OLRC.

| Capability | Description |
|------------|-------------|
| Converter | Full pipeline: XML stream → SAX parse → AST build → render → write, at section/chapter/title granularity |
| Downloader | Fetches individual or bulk title ZIP files directly from OLRC |
| Metadata | `_meta.json` indexes, `README.md` overviews, Dublin Core metadata, release points, positive law status |
| Structural Fidelity | Preserves the full USLM hierarchy using bold inline numbering that mirrors legal citation conventions |
| Tables | XHTML tables and USLM layout tables converted to Markdown pipe tables |
| Edge Cases | Appendix titles (5, 11, 18, 28) to separate directories, duplicate section disambiguation (`-2`, `-3` suffixes) |

**Dependencies**: `@lexbuild/core`, `yauzl`

### @lexbuild/ecfr

Implements everything specific to the GPO/SGML-derived XML from govinfo's eCFR bulk data.

| Capability | Description |
|------------|-------------|
| eCFR AST Builder | Stack-based SAX→AST construction for GPO/SGML XML (DIV-based hierarchy, E emphasis codes) |
| Converter | Full pipeline with section/part/chapter/title granularity, `_meta.json`, and `README.md` generation |
| Downloader | Fetches individual title XML files from govinfo (plain XML per title, no ZIP) |
| Regulatory Metadata | Authority and source citations extracted from part-level AUTH/SOURCE elements to frontmatter |
| Tables | HTML-style tables (TABLE/TR/TH/TD) converted to Markdown pipe tables |

**Dependencies**: `@lexbuild/core`

### @lexbuild/cli

Provides the `lexbuild` binary that end users install. `@lexbuild/cli` is orchestration layer where all heavy lifting is delegated to the source packages and core.

| Command | Description |
|---------|-------------|
| `lexbuild download-usc` | Fetch [U.S. Code XML](https://uscode.house.gov/download/download.shtml) from the [OLRC](https://uscode.house.gov/) |
| `lexbuild convert-usc` | Convert [U.S. Code XML](https://uscode.house.gov/download/download.shtml) to structured Markdown |
| `lexbuild download-ecfr` | Fetch [eCFR XML](https://www.govinfo.gov/bulkdata/ECFR) from [GovInfo](https://www.govinfo.gov/) |
| `lexbuild convert-ecfr` | Convert [eCFR XML](https://www.govinfo.gov/bulkdata/ECFR) to structured Markdown |

**Dependencies**: `@lexbuild/core`, `@lexbuild/usc`, `@lexbuild/ecfr`, `commander`, `chalk`, `ora`, `cli-table3`

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
| `-g, --granularity <level>` | `section` | `section`, `part`, `chapter`, or `title` |
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

**Chapter granularity** (`-g chapter`):

```
output/ecfr/
  title-17/
    chapter-I/
      chapter-I.md
    chapter-II/
      chapter-II.md
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

---

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code conventions, testing guidelines, and the PR checklist.

---

## License

[MIT](LICENSE)
