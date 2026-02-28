# law2md

Convert U.S. legislative XML into structured Markdown for AI and RAG systems.

> **Status: In Development** -- law2md is under active development. Phase 1 (foundation) is complete. The tool can convert U.S. Code XML to section-level Markdown with frontmatter metadata. See [Project Status](#project-status) for details on what works today and what is planned.

---

## Overview

`law2md` is a command-line tool that converts official U.S. Code XML files (published in the [USLM schema](https://uscode.house.gov/download/resources/USLM-User-Guide.pdf) by the Office of the Law Revision Counsel) into clean, structured Markdown optimized for AI ingestion, retrieval-augmented generation (RAG), and legal research workflows.

The U.S. Code comprises 54 titles of federal statutory law. The official XML representation is deeply nested, laden with presentation markup, and difficult to work with directly. `law2md` transforms this XML into per-section Markdown files with YAML frontmatter, predictable file paths, and content sized for typical embedding models.

### Why This Exists

Legal texts are among the most frequently cited sources in AI systems, yet there is no production-grade, open-source pipeline that converts canonical legislative XML into chunked, metadata-rich Markdown suitable for embedding and retrieval. `law2md` fills that gap.

### Key Features

- **Streaming SAX parser** -- processes XML files of any size (including 100MB+ titles like Title 26) with bounded memory usage
- **Section-level output** -- each section of the U.S. Code becomes its own Markdown file, sized appropriately for RAG chunk windows
- **YAML frontmatter** -- every file includes structured metadata (identifier, title, chapter, section, positive law status, source credit, currency)
- **Structural fidelity** -- preserves the full USLM hierarchy from title down through subsubitem, using bold inline numbering that mirrors legal citation convention
- **Source credits and notes** -- editorial notes, statutory notes, amendment history, and source credits are included with the statutory text

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

Download one or more title XML files from the [OLRC download page](https://uscode.house.gov/download/download.shtml). Each title is distributed as a zip file containing a single XML file (e.g., `usc01.xml` for Title 1).

Place the extracted XML files in a directory of your choice.

### Convert to Markdown

```bash
# Convert a single title
node packages/cli/dist/index.js convert path/to/usc01.xml -o ./output

# With verbose output
node packages/cli/dist/index.js convert path/to/usc01.xml -o ./output -v
```

### CLI Options

```
law2md convert <input> [options]

Arguments:
  input                          Path to a USC XML file

Options:
  -o, --output <dir>             Output directory (default: "./output")
  --link-style <style>           Cross-reference style: "plaintext", "canonical",
                                 or "relative" (default: "plaintext")
  --no-include-source-credits    Exclude source credit annotations
  -v, --verbose                  Enable verbose logging
  -h, --help                     Display help
```

## Output Format

### Directory Structure

```
output/
  usc/
    title-01/
      chapter-01/
        section-1.md
        section-2.md
        ...
      chapter-02/
        section-101.md
        ...
```

Title directories are zero-padded to two digits (`title-01` through `title-54`). Chapter directories follow the same convention. Section files use the section number as-is, which may be alphanumeric (e.g., `section-106a.md`, `section-7801.md`).

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
generator: "law2md@0.1.0"
source_credit: "(Added Pub. L. 104–199, § 3(a), Sept. 21, 1996, ...)"
---
```

```markdown
# § 7. Marriage

**(a)** For the purposes of any Federal law, rule, or regulation in which
marital status is a factor, an individual shall be considered married if...

**(b)** In this section, the term "State" means a State, the District of
Columbia, the Commonwealth of Puerto Rico, or any other territory...

---

**Source Credit**: (Added Pub. L. 104–199, § 3(a), Sept. 21, 1996, ...)

## Editorial Notes

### Amendments

2022— amended section generally. Prior to amendment, text read as follows: ...
```

Subsections and below use bold inline numbering (`**(a)**`, `**(1)**`, `**(A)**`, `**(i)**`) rather than Markdown headings. This preserves a flat document structure that works well with embedding models and chunking strategies. The numbering scheme follows standard legal citation convention.

For the complete output format specification, see [docs/OUTPUT_FORMAT.md](docs/OUTPUT_FORMAT.md).

## Project Status

### Phase 1: Foundation -- Complete

The core conversion pipeline is functional. `law2md` can convert any U.S. Code title XML file to section-level Markdown with frontmatter, source credits, editorial notes, and statutory notes.

Verified against Title 1 (General Provisions): 39 sections across 3 chapters converted in under 1 second.

### Phase 2: Content Fidelity -- Planned

- Cross-reference link resolution (relative links within the output corpus, OLRC fallback URLs)
- XHTML table and USLM layout table conversion
- Table of contents generation
- Notes filtering (selective inclusion of editorial, statutory, amendment notes)
- Chapter-level granularity mode
- `_meta.json` sidecar index generation

### Phase 3: Scale and Download -- Planned

- Built-in OLRC download command (`law2md download`)
- Memory profiling and optimization for large titles (Title 26, Title 42)
- Concurrent file writes
- Dry-run mode
- Appendix title handling

### Phase 4: Polish and Publish -- Planned

- npm package publication
- GitHub Actions CI/CD
- Snapshot test suite for output stability
- Token estimation via `tiktoken` in metadata indexes

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
pnpm turbo test             # Run all tests
pnpm turbo lint             # Lint all packages
pnpm turbo typecheck        # Type-check all packages
```

See [CLAUDE.md](CLAUDE.md) for detailed code conventions, schema reference, and design decisions.

## Data Sources

`law2md` processes XML files published by the [Office of the Law Revision Counsel](https://uscode.house.gov/) (OLRC) of the U.S. House of Representatives. The XML uses the United States Legislative Markup (USLM) 1.0 schema.

The U.S. Code XML is public domain and freely available for download at [uscode.house.gov/download/download.shtml](https://uscode.house.gov/download/download.shtml).

## License

[MIT](LICENSE)
