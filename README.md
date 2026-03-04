# lexbuild

[![npm](https://img.shields.io/npm/v/lexbuild?style=flat-square)](https://www.npmjs.com/package/lexbuild)
[![CI](https://img.shields.io/github/actions/workflow/status/chris-c-thomas/lexbuild/ci.yml?style=flat-square&label=CI)](https://github.com/chris-c-thomas/lexbuild/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/node/v/lexbuild?style=flat-square)](https://nodejs.org/)
[![license](https://img.shields.io/github/license/chris-c-thomas/lexbuild?style=flat-square)](LICENSE)

CLI tool to download and convert the entire [United States Code](https://uscode.house.gov/) from official XML (USLM Schema) into structured Markdown that's optimized for AI ingestion, RAG pipelines, and semantic search.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Output](#output)
- [Performance](#performance)
- [Project Structure](#project-structure)
- [Development](#development)
- [Documentation](#documentation)
- [Data Sources](#data-sources)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The U.S. Code comprises 54 titles of federal statutory law. The [Office of the Law Revision Counsel](https://uscode.house.gov/about_office.xhtml) (OLRC) publishes the official text as [deeply nested XML](https://uscode.house.gov/download/download.shtml) using the [United States Legislative Markup](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf) (USLM) schema. These files are dense, laden with presentation markup, and difficult to work with directly.

`lexbuild` transforms this XML into per-section Markdown files with YAML frontmatter, predictable file paths, and content sized for typical embedding model context windows — making the entire U.S. Code accessible to LLMs, vector databases, and legal research tools.

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

## Install

### npm

```bash
npm install -g lexbuild
```

### npx

```bash
npx lexbuild download --all
npx lexbuild convert --all
```

### Source

Requires [Node.js](https://nodejs.org/) >= 20 and [pnpm](https://pnpm.io/) >= 10.

```bash
git clone https://github.com/chris-c-thomas/lexbuild.git
cd lexbuild
pnpm install
pnpm turbo build
```

---

## Quick Start

```bash
# Download and convert all 54 titles
lexbuild download --all && lexbuild convert --all

# Or start small — download and convert Title 1
lexbuild download --titles 1 && lexbuild convert --titles 1

# Download and convert a range
lexbuild download --titles 1-5 && lexbuild convert --titles 1-5
```

---

## Usage

### Download

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

### Convert

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

## Project Structure

```
lexbuild/
  packages/
    core/          @lexbuild/core — XML parsing, AST, Markdown rendering
    usc/           @lexbuild/usc — U.S. Code downloader and conversion logic
    cli/           lexbuild — CLI entry point
  fixtures/
    fragments/     XML snippets for unit tests
    expected/      Expected output snapshots
  docs/            Architecture, XML reference, output format, exending
```

The project is a monorepo managed with [pnpm](https://pnpm.io/) workspaces and [Turborepo](https://turbo.build/).

The separation into `core` and `usc` packages is designed to support additional legal source types (CFR, state statutes) in the future by adding new packages that share the core infrastructure.

---

## Development

```bash
pnpm install               # Install dependencies
pnpm turbo build           # Build all packages
pnpm turbo test            # Run all 176 tests
pnpm turbo lint            # Lint all packages
pnpm turbo typecheck       # Type-check all packages
pnpm turbo dev             # Watch mode (rebuild on change)
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

`lexbuild` processes XML published by the [Office of the Law Revision Counsel](https://uscode.house.gov/) (OLRC) of the U.S. House of Representatives. The XML uses the United States Legislative Markup (USLM) 1.0 schema.

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

- [ ] Code of Federal Regulations (CFR)
- [ ] State statutes
- [ ] Incremental update support for new OLRC release points

**Metadata**

- [ ] Parent path metadata — full structural ancestry per section
- [ ] Related sections — sibling references for contextual RAG retrieval
- [ ] Cross-reference graph export (JSON/GraphML)

**Tooling**

- [ ] MCP server for AI-assisted legal research
- [ ] Embedding pipeline integration

---

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code conventions, testing guidelines, and the PR checklist.

---

## License

[MIT](LICENSE)
