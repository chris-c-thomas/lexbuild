# law2md

[![CI](https://img.shields.io/github/actions/workflow/status/chris-c-thomas/law2md/ci.yml?style=flat-square&label=CI)](https://github.com/chris-c-thomas/law2md/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/law2md?style=flat-square)](https://www.npmjs.com/package/law2md)
[![license](https://img.shields.io/github/license/chris-c-thomas/law2md?style=flat-square)](LICENSE)
[![issues](https://img.shields.io/github/issues/chris-c-thomas/law2md?style=flat-square)](https://github.com/chris-c-thomas/law2md/issues)
[![pull requests](https://img.shields.io/github/issues-pr/chris-c-thomas/law2md?style=flat-square)](https://github.com/chris-c-thomas/law2md/pulls)

Convert the United States Code into structured Markdown for AI and RAG Systems.

---

## Overview

`law2md` is a command-line tool that converts [XML files](https://uscode.house.gov/download/download.shtml) of the United States Code published by the [Office of the Law Revision Counsel](https://uscode.house.gov/) into clean, structured Markdown optimized for AI ingestion, retrieval-augmented generation (RAG), and legal research workflows.

The U.S. Code comprises 54 titles of federal statutory law. The official XML is deeply nested, laden with presentation markup, and difficult to work with directly. The OLRC provides a user guide for the [United States Legislative Markup](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf).

`law2md` transforms this XML into per-section, or optional per-chapter, Markdown files with YAML frontmatter, predictable file paths, and content sized for typical embedding models.

### Features

- **Built-in downloader** -- fetch individual titles or the entire U.S. Code directly from OLRC
- **Streaming SAX parser** -- processes XML files of any size (including 100MB+ titles) with bounded memory
- **Section-level output** -- each section becomes its own Markdown file, sized for RAG chunk windows
- **Chapter-level output** -- optional mode that inlines all sections into per-chapter files
- **YAML frontmatter** -- structured metadata on every file (identifier, title, chapter, section, status, source credit)
- **Structural fidelity** -- preserves the full USLM hierarchy using bold inline numbering that mirrors legal citation convention
- **Cross-reference links** -- resolved as relative links within the corpus, or as OLRC website URLs
- **Filterable notes** -- editorial notes, statutory notes, and amendment history can be selectively included or excluded
- **Metadata indexes** -- `_meta.json` sidecar files with section listings and token estimates
- **Tables** -- XHTML tables and USLM layout tables converted to Markdown pipe tables
- **Dry-run mode** -- preview conversion stats without writing files
- **Appendix handling** -- titles with appendices (5, 11, 18, 28) output to separate directories

---

## Installation

### From npm

```bash
npm install -g law2md
```

### From source

Requires [Node.js](https://nodejs.org/) >= 20 and [pnpm](https://pnpm.io/) >= 10.

```bash
git clone https://github.com/chris-c-thomas/law2md.git
cd law2md
pnpm install
pnpm turbo build
```

---

## Quick Start

```bash
# Download Title 1 (smallest title, good for testing)
law2md download --title 1 -o ./xml

# Convert to Markdown
law2md convert ./xml/usc01.xml -o ./output

# Or do both in one shot
law2md download --title 1 -o ./xml && law2md convert ./xml/usc01.xml -o ./output
```

---

## Usage

### Download

Fetch U.S. Code XML files directly from the Office of the Law Revision Counsel:

```bash
# Download a single title
law2md download --title 1 -o ./xml

# Download all 54 titles
law2md download --all -o ./xml

# Use a specific release point
law2md download --title 26 -o ./xml --release-point 119-73not60
```

Or download manually from the [OLRC download page](https://uscode.house.gov/download/download.shtml).

### Convert

```bash
# Section-level output (default)
law2md convert ./xml/usc01.xml -o ./output

# Chapter-level output
law2md convert ./xml/usc01.xml -o ./output -g chapter

# Cross-reference links resolved to OLRC URLs
law2md convert ./xml/usc05.xml -o ./output --link-style canonical

# Include only amendment notes
law2md convert ./xml/usc01.xml -o ./output --include-amendments

# Exclude all notes
law2md convert ./xml/usc01.xml -o ./output --no-include-notes

# Dry-run: preview stats without writing files
law2md convert ./xml/usc42.xml -o ./output --dry-run
```

### CLI Reference

```
law2md convert <input> [options]

Arguments:
  input                          Path to a USC XML file

Options:
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

law2md download [options]

Options:
  --title <number>               Download a single title (1-54)
  --all                          Download all 54 titles
  -o, --output <dir>             Output directory (default: "./fixtures/xml")
  --release-point <point>        OLRC release point (default: current)
  -h, --help                     Display help
```

When multiple `--include-*-notes` flags are specified, they combine additively.

---

## Output Format

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
generator: "law2md@0.4.0"
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

Subsections and below use bold inline numbering (`**(a)**`, `**(1)**`, `**(A)**`, `**(i)**`) rather than Markdown headings. This preserves a flat document structure optimized for embedding models and chunking strategies.

### Metadata Indexes

Each title directory includes a `_meta.json` file for programmatic access:

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

## Project Structure

```
law2md/
  packages/
    core/          @law2md/core -- XML parsing, AST, Markdown rendering
    usc/           @law2md/usc -- U.S. Code conversion logic and downloader
    cli/           law2md -- CLI entry point (the published npm package)
  fixtures/
    fragments/     Small XML snippets for unit tests
    expected/      Expected output snapshots
  docs/            Architecture, output format spec, extension guide
```

The project is a monorepo managed with [pnpm](https://pnpm.io/) workspaces and [Turborepo](https://turbo.build/). The separation into `core` and `usc` packages is designed to support additional legal source types (CFR, state statutes) by adding new packages that share the core infrastructure.

---

## Development

```bash
pnpm install               # Install dependencies
pnpm turbo build           # Build all packages
pnpm turbo test            # Run all tests
pnpm turbo lint            # Lint all packages
pnpm turbo typecheck       # Type-check all packages
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.

---

## Documentation

- [Output Format Specification](docs/output-format.md) -- directory layout, frontmatter schema, metadata indexes, RAG guidance
- [Architecture](docs/architecture.md) -- system overview, package design, data flow, memory profile
- [XML Element Reference](docs/xml-element-reference.md) -- USLM element mapping and Markdown output
- [Extending](docs/extending.md) -- guide for adding new legal source types

---

## Data Sources

`law2md` processes XML published by the [Office of the Law Revision Counsel](https://uscode.house.gov/) (OLRC) of the U.S. House of Representatives. The XML uses the United States Legislative Markup (USLM) 1.0 schema.

The U.S. Code XML is public domain and freely available at [uscode.house.gov/download/download.shtml](https://uscode.house.gov/download/download.shtml).

---

## License

MIT. See [LICENSE](LICENSE).
