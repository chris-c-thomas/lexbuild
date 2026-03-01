# law2md

Convert the U.S. Code source XML content into structured Markdown for use with AI and RAG systems.

> **Status: In Development** -- Phases 1 through 3 are complete. The tool downloads and converts all 54 titles of the U.S. Code XML to section-level or chapter-level Markdown with frontmatter, tables, filterable notes, cross-reference link resolution, and metadata indexes. See [Project Status](#project-status) for details.

## Overview

`law2md` is a command-line tool that converts official U.S. Code XML files (published in the [USLM schema](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf) by the Office of the Law Revision Counsel) into clean, structured Markdown optimized for AI ingestion, retrieval-augmented generation (RAG), and legal research workflows.

The U.S. Code comprises 54 titles of federal statutory law. The official XML representation is deeply nested, laden with presentation markup, and difficult to work with directly. `law2md` transforms this XML into per-section Markdown files with YAML frontmatter, predictable file paths, and content sized for typical embedding models.

### Why This Exists

Legal texts are among the most frequently cited sources in AI systems, yet there is no production-grade, open-source pipeline that converts canonical legislative XML into chunked, metadata-rich Markdown suitable for embedding and retrieval. `law2md` fills that gap.

### Key Features

- **Built-in downloader** -- download individual titles or the entire U.S. Code directly from OLRC with `law2md download`
- **Streaming SAX parser** -- processes XML files of any size (including 100MB+ titles like Title 42) with bounded memory usage
- **Section-level output** -- each section of the U.S. Code becomes its own Markdown file, sized appropriately for RAG chunk windows
- **Chapter-level output** -- optional mode that inlines all sections into per-chapter files
- **YAML frontmatter** -- every file includes structured metadata (identifier, title, chapter, part, section, positive law status, source credit, currency, status)
- **Structural fidelity** -- preserves the full USLM hierarchy from title down through subsubitem, using bold inline numbering that mirrors legal citation convention
- **Tables** -- XHTML tables and USLM layout tables converted to Markdown pipe tables
- **Cross-reference links** -- resolve within the output corpus as relative links, or fall back to OLRC website URLs
- **Filterable notes** -- editorial notes, statutory notes, and amendment history can be selectively included or excluded
- **Metadata indexes** -- `_meta.json` sidecar files at title and chapter levels with section listings and token estimates
- **Source credits** -- enactment source annotations included with each section
- **Dry-run mode** -- preview conversion stats (sections, chapters, tokens, memory) without writing files
- **Appendix handling** -- titles with appendices (5, 11, 18, 28) output to separate directories

## Installation

> **Note:** `law2md` has not yet been published to npm. For now, clone the repository and build from source.

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20 LTS
- [pnpm](https://pnpm.io/) >= 10

### Build from Source

```bash
git clone https://github.com/your-username/law2md.git
cd law2md
pnpm install
pnpm turbo build
```

## Usage

### Download U.S. Code XML

Use the built-in download command to fetch title XML files directly from OLRC:

```bash
# Download a single title
node packages/cli/dist/index.js download --title 1 -o ./fixtures/xml

# Download all 54 titles
node packages/cli/dist/index.js download --all -o ./fixtures/xml

# Use a specific release point
node packages/cli/dist/index.js download --title 26 -o ./fixtures/xml --release-point 119-73not60
```

Or download manually from the [OLRC download page](https://uscode.house.gov/download/download.shtml). Each title is distributed as a zip file containing a single XML file (e.g., `usc01.xml` for Title 1).

### Convert to Markdown

```bash
# Convert a single title (section-level output)
node packages/cli/dist/index.js convert path/to/usc01.xml -o ./output

# Chapter-level output (sections inlined into chapter files)
node packages/cli/dist/index.js convert path/to/usc01.xml -o ./output -g chapter

# With cross-reference links resolved to OLRC URLs
node packages/cli/dist/index.js convert path/to/usc05.xml -o ./output --link-style canonical

# Include only amendment notes
node packages/cli/dist/index.js convert path/to/usc01.xml -o ./output --include-amendments

# Exclude all notes
node packages/cli/dist/index.js convert path/to/usc01.xml -o ./output --no-include-notes

# Verbose output showing all written files
node packages/cli/dist/index.js convert path/to/usc01.xml -o ./output -v

# Dry-run: preview stats without writing files
node packages/cli/dist/index.js convert path/to/usc42.xml -o ./output --dry-run
```

### CLI Options

```
law2md convert <input> [options]

Arguments:
  input                          Path to a USC XML file

Options:
  -o, --output <dir>             Output directory (default: "./output")
  -g, --granularity <level>      Output granularity: "section" or "chapter"
                                 (default: "section")
  --link-style <style>           Cross-reference style: "plaintext", "canonical",
                                 or "relative" (default: "plaintext")
  --no-include-source-credits    Exclude source credit annotations
  --no-include-notes             Exclude all notes
  --include-editorial-notes      Include editorial notes only
  --include-statutory-notes      Include statutory notes only
  --include-amendments           Include amendment history notes only
  --dry-run                      Parse and report structure without writing files
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

When multiple `--include-*-notes` flags are specified, they combine additively. Specifying any selective flag automatically switches from the default "include all notes" behavior to "include only selected categories."

## Output Format

### Section-Level Directory Structure (default)

```
output/
  usc/
    title-01/
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

### Chapter-Level Directory Structure (`--granularity chapter`)

```
output/
  usc/
    title-01/
      _meta.json
      chapter-01.md
      chapter-02.md
      chapter-03.md
```

Title directories are zero-padded to two digits (`title-01` through `title-54`). Chapter directories and files follow the same convention. Section files use the section number as-is, which may be alphanumeric (e.g., `section-106a.md`, `section-7801.md`).

### Markdown Structure

Each section file consists of YAML frontmatter followed by the statutory text:

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
generator: "law2md@0.3.0"
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

## Editorial Notes

### Amendments

2022-- amended section generally. Prior to amendment, text read as follows: ...
```

Subsections and below use bold inline numbering (`**(a)**`, `**(1)**`, `**(A)**`, `**(i)**`) rather than Markdown headings. This preserves a flat document structure that works well with embedding models and chunking strategies. The numbering scheme follows standard legal citation convention.

### Metadata Indexes

Each title and chapter directory includes a `_meta.json` file with structured metadata for programmatic access:

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

For the complete output format specification, see [docs/OUTPUT_FORMAT.md](docs/OUTPUT_FORMAT.md).

## Project Status

### Phase 1: Foundation -- Complete (v0.1.0)

Core conversion pipeline: SAX streaming parser, AST builder with section-emit pattern, Markdown renderer, YAML frontmatter generator, USC converter, and CLI `convert` command.

### Phase 2: Content Fidelity -- Complete (v0.2.0)

Content quality improvements: whitespace normalization, cross-reference link resolver (relative/canonical/plaintext), XHTML and USLM layout table conversion, notes filtering with CLI flags, `_meta.json` sidecar index generation, and chapter-level granularity mode.

### Phase 3: Scale and Download -- Complete (v0.3.0)

Built-in OLRC downloader with zip extraction (`law2md download`), dry-run mode for conversion previews, peak memory and token reporting, appendix title handling (Titles 5a, 11a, 18a, 28a), duplicate section number disambiguation, and status edge case handling (repealed, reserved, transferred sections).

E2E verified: all 54 titles (58 files including appendices), 60,261 sections, 25 seconds total.

### Phase 4: Polish and Publish -- Planned

- npm package publication
- GitHub Actions CI/CD
- Snapshot test suite for output stability
- Token estimation via `tiktoken` in metadata indexes
- Title and chapter README.md generation

## Repository Structure

```
law2md/
  packages/
    core/          @law2md/core -- XML parsing, AST, Markdown rendering
    usc/           @law2md/usc -- U.S. Code-specific conversion logic
    cli/           law2md -- CLI entry point
  fixtures/
    xml/           Full USC XML files (not committed, user-provided)
    fragments/     Small XML snippets for unit tests
    expected/      Expected output snapshots
  docs/            Architecture, output format spec, extension guide
```

The project is structured as a monorepo managed with [pnpm](https://pnpm.io/) workspaces and [Turborepo](https://turbo.build/). The separation into `core` and `usc` packages is intentional -- the architecture is designed to support additional legal source types (Code of Federal Regulations, state statutes) by adding new packages that share the core XML parsing and Markdown rendering infrastructure.

## Development

```bash
pnpm install               # Install dependencies
pnpm turbo build            # Build all packages
pnpm turbo test             # Run all tests (121 tests)
pnpm turbo lint             # Lint all packages
pnpm turbo typecheck        # Type-check all packages
```

See [CLAUDE.md](CLAUDE.md) for detailed code conventions, schema reference, and design decisions.

## Data Sources

`law2md` processes XML files published by the [Office of the Law Revision Counsel](https://uscode.house.gov/) (OLRC) of the U.S. House of Representatives. The XML uses the United States Legislative Markup (USLM) 1.0 schema.

The U.S. Code XML is public domain and freely available for download at [uscode.house.gov/download/download.shtml](https://uscode.house.gov/download/download.shtml).

## License

MIT. See [LICENSE](LICENSE).
