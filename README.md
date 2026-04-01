# LexBuild

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcli?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/chris-c-thomas/LexBuild/ci.yml?style=for-the-badge&label=CI)](https://github.com/chris-c-thomas/LexBuild/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=for-the-badge)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen?style=for-the-badge)](https://nodejs.org/)
[![license](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

[LexBuild](https://lexbuild.dev) is an open-source toolchain for U.S. legal texts. It transforms official source XML into structured Markdown with rich metadata, optimized for LLMs, RAG pipelines, and semantic search.

## Table of Contents

- [Overview](#overview)
- [Sources](#sources)
- [Install](#install)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Output](#output)
- [Monorepo](#monorepo)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The [United States Code](https://uscode.house.gov/) is the official codification of federal statutory law, organized into 54 titles. It is available as [USLM XML](https://github.com/usgpo/uslm) from the [Office of the Law Revision Counsel](https://uscode.house.gov/about_office.xhtml) (OLRC).

The [Code of Federal Regulations](https://www.govinfo.gov/app/collection/cfr/) (CFR) is the official codification of federal administrative regulations, organized into 50 titles. The [Electronic Code of Federal Regulations](https://www.ecfr.gov/) (eCFR) is a continuously updated editorial compilation incorporating changes as they appear in the [Federal Register](https://www.federalregister.gov/). eCFR XML is available from the [ecfr.gov API](https://www.ecfr.gov/api/versioner/v1/titles) (daily-updated) and [GovInfo](https://www.govinfo.gov/bulkdata/ECFR) (bulk data).

Both formats are dense and deeply nested, making them difficult to work with directly.

LexBuild transforms this XML into per-section Markdown files with YAML frontmatter, predictable file paths, and content sized for typical embedding model context windows, making the full corpus of federal law and regulations accessible to LLMs, vector databases, and legal research tools.

---

## Sources

| Source | Package | XML Format | Titles | Status |
|--------|---------|------------|--------|--------|
| U.S. Code | [`@lexbuild/usc`](packages/usc/) | USLM 1.0 | 54 | Stable |
| eCFR | [`@lexbuild/ecfr`](packages/ecfr/) | GPO/SGML | 50 | Stable |
| Annual CFR | `@lexbuild/cfr` | GPO/SGML | 50 | Planned |
| Federal Register | [`@lexbuild/fr`](packages/fr/) | GPO/SGML | ~30k docs/yr | Stable |
| State statutes | `@lexbuild/state-*` | Varies | — | Exploratory |

### Data Sources

| Source | Download From | Update Frequency | Notes |
|--------|--------------|-----------------|-------|
| **U.S. Code** | [uscode.house.gov](https://uscode.house.gov/download/download.shtml) | Irregular | Release point auto-detected from OLRC download page |
| **eCFR** (default) | [ecfr.gov](https://www.ecfr.gov/api/versioner/v1/titles) | Daily | Point-in-time support via `--date` flag |
| **eCFR** (fallback) | [govinfo.gov](https://www.govinfo.gov/bulkdata/ECFR) | Irregular | Bulk XML. Updates per-title as regulations change |
| **Federal Register** | [federalregister.gov](https://www.federalregister.gov/developers/documentation/api/v1) | Daily | Per-document XML + JSON metadata. |

---

## Install

### Run Directly (no install)

```bash
npx @lexbuild/cli download-usc --all
npx @lexbuild/cli convert-usc --all
```

### Global Install

```bash
npm install -g @lexbuild/cli
# or
pnpm add -g @lexbuild/cli
```

### Build From Source

Requires [Node.js](https://nodejs.org/) >= 22 and [pnpm](https://pnpm.io/) >= 10.

```bash
git clone https://github.com/chris-c-thomas/LexBuild.git
cd LexBuild
pnpm install && pnpm turbo build
```

---

## Quick Start

### U.S. Code

```bash
# Download and convert all 54 titles
lexbuild download-usc --all && lexbuild convert-usc --all

# Start small — a single title
lexbuild download-usc --titles 1 && lexbuild convert-usc --titles 1

# A range of titles
lexbuild download-usc --titles 1-5 && lexbuild convert-usc --titles 1-5
```

### eCFR

```bash
# Download and convert all 50 titles
lexbuild download-ecfr --all && lexbuild convert-ecfr --all

# A single title
lexbuild download-ecfr --titles 17 && lexbuild convert-ecfr --titles 17

# Point-in-time download (CFR as of a specific date)
lexbuild download-ecfr --all --date 2025-01-01
```

### Federal Register

```bash
# Download and convert recent documents
lexbuild download-fr --recent 30 && lexbuild convert-fr --all

# Download a specific date range
lexbuild download-fr --from 2026-01-01 --to 2026-03-31
lexbuild convert-fr --all

# Download only rules
lexbuild download-fr --from 2026-01-01 --types rule

# Download a single document
lexbuild download-fr --document 2026-06029
```

---

## Commands

### `download-usc`

Fetch U.S. Code XML from the OLRC. Auto-detects the latest release point.

```bash
lexbuild download-usc --all                                  # All 54 titles
lexbuild download-usc --titles 1-5,8,11                      # Specific titles
lexbuild download-usc --all --release-point 119-73not60      # Pin a release
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s): `1`, `1-5`, `1-5,8,11` |
| `--all` | — | Download all 54 titles (single bulk zip) |
| `-o, --output <dir>` | `./downloads/usc/xml` | Output directory |
| `--release-point <id>` | auto-detected | Pin a specific OLRC release point |

### `convert-usc`

Convert downloaded USC XML to Markdown.

```bash
lexbuild convert-usc --all                                   # All downloaded titles
lexbuild convert-usc --titles 1 -g chapter                   # Chapter-level output
lexbuild convert-usc --titles 26 --dry-run                   # Preview without writing
lexbuild convert-usc ./downloads/usc/xml/usc01.xml           # Direct file path
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s) to convert |
| `--all` | — | Convert all titles in input directory |
| `-i, --input-dir <dir>` | `./downloads/usc/xml` | Input XML directory |
| `-o, --output <dir>` | `./output` | Output directory |
| `-g, --granularity` | `section` | `section`, `chapter`, or `title` |
| `--link-style` | `plaintext` | `plaintext`, `canonical`, or `relative` |
| `--no-include-source-credits` | — | Exclude source credits |
| `--no-include-notes` | — | Exclude all notes |
| `--include-editorial-notes` | — | Include editorial notes only |
| `--include-statutory-notes` | — | Include statutory notes only |
| `--include-amendments` | — | Include amendment notes only |
| `--dry-run` | — | Parse and report without writing |
| `-v, --verbose` | — | Verbose output |

### `list-release-points`

Browse available OLRC release points for the U.S. Code. Useful for discovering prior versions to download.

```bash
lexbuild list-release-points                     # 20 most recent
lexbuild list-release-points -n 5                # 5 most recent
lexbuild list-release-points -n 0                # All available release points
```

Use a release point ID from the output to pin a specific version:

```bash
lexbuild download-usc --all --release-point 119-72not60
```

### `download-ecfr`

Fetch eCFR XML. Defaults to the ecfr.gov API (daily-updated); govinfo bulk data available as fallback.

```bash
lexbuild download-ecfr --all                                 # All 50 titles (eCFR API)
lexbuild download-ecfr --titles 1-5,17                       # Specific titles
lexbuild download-ecfr --all --date 2025-01-01               # Point-in-time download
lexbuild download-ecfr --all --source govinfo                # Govinfo bulk fallback
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s): `1`, `1-5`, `1-5,17` |
| `--all` | — | Download all 50 titles |
| `-o, --output <dir>` | `./downloads/ecfr/xml` | Output directory |
| `--source` | `ecfr-api` | `ecfr-api` (daily-updated) or `govinfo` (bulk) |
| `--date <YYYY-MM-DD>` | current | Point-in-time date (ecfr-api only) |

### `convert-ecfr`

Convert downloaded eCFR XML to Markdown.

```bash
lexbuild convert-ecfr --all                                  # All downloaded titles
lexbuild convert-ecfr --titles 17 -g part                    # Part-level output
lexbuild convert-ecfr --all --dry-run                        # Preview without writing
lexbuild convert-ecfr ./downloads/ecfr/xml/ECFR-title17.xml  # Direct file path
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s) to convert |
| `--all` | — | Convert all titles in input directory |
| `-i, --input-dir <dir>` | `./downloads/ecfr/xml` | Input XML directory |
| `-o, --output <dir>` | `./output` | Output directory |
| `-g, --granularity` | `section` | `section`, `part`, `chapter`, or `title` |
| `--link-style` | `plaintext` | `plaintext`, `canonical`, or `relative` |
| `--no-include-source-credits` | — | Exclude source credits |
| `--no-include-notes` | — | Exclude all notes |
| `--include-editorial-notes` | — | Include editorial/regulatory notes only |
| `--include-statutory-notes` | — | Include statutory notes only |
| `--include-amendments` | — | Include amendment notes only |
| `--dry-run` | — | Parse and report without writing |
| `-v, --verbose` | — | Verbose output |

### `download-fr`

Fetch Federal Register XML and metadata from the FederalRegister.gov API.

```bash
lexbuild download-fr --recent 30                                    # Last 30 days
lexbuild download-fr --from 2026-01-01 --to 2026-03-31              # Date range
lexbuild download-fr --from 2026-01-01 --types rule                 # Only rules
lexbuild download-fr --document 2026-06029                          # Single document
```

| Option | Default | Description |
|--------|---------|-------------|
| `--from <YYYY-MM-DD>` | — | Start date (inclusive) |
| `--to <YYYY-MM-DD>` | today | End date (inclusive) |
| `--recent <days>` | — | Download last N days |
| `--document <number>` | — | Single document by number |
| `-o, --output <dir>` | `./downloads/fr` | Output directory |
| `--types` | all | `rule`, `proposed_rule`, `notice`, `presidential_document` |
| `--limit <n>` | — | Max documents (for testing) |

### `convert-fr`

Convert downloaded FR XML to Markdown.

```bash
lexbuild convert-fr --all                                           # All downloaded documents
lexbuild convert-fr --from 2026-01-01 --to 2026-03-31               # Filter by date range
lexbuild convert-fr --all --types rule                               # Only rules
lexbuild convert-fr ./downloads/fr/2026/03/2026-06029.xml           # Single file
```

| Option | Default | Description |
|--------|---------|-------------|
| `--all` | — | Convert all documents in input directory |
| `--from <YYYY-MM-DD>` | — | Filter start date |
| `--to <YYYY-MM-DD>` | — | Filter end date |
| `-i, --input-dir <dir>` | `./downloads/fr` | Input directory |
| `-o, --output <dir>` | `./output` | Output directory |
| `--types` | all | Filter by document type |
| `--link-style` | `plaintext` | `plaintext`, `canonical`, or `relative` |
| `--dry-run` | — | Parse and report without writing |
| `-v, --verbose` | — | Verbose output |

---

## Output

### File Structure

**U.S. Code** (`-g section`, default):
```
output/usc/
  title-01/
    README.md
    _meta.json
    chapter-01/
      _meta.json
      section-1.md
      section-2.md
```

**eCFR** (`-g section`, default):
```
output/ecfr/
  title-17/
    README.md
    _meta.json
    chapter-IV/
      part-240/
        _meta.json
        section-240.10b-5.md
```

**Federal Register**:
```
output/fr/
  2026/
    03/
      2026-06029.md
      _meta.json
```

All granularity levels:

| Source | section | chapter/part | title |
|--------|---------|-------------|-------|
| USC | `title-01/chapter-01/section-1.md` | `title-01/chapter-01/chapter-01.md` | `title-01.md` |
| eCFR | `title-17/chapter-IV/part-240/section-240.10b-5.md` | `title-17/chapter-IV/part-240.md` | `title-17.md` |
| FR | `2026/03/2026-06029.md` | — | — |

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
generator: "lexbuild@1.9.3"
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
section_number: "240.10b-5"
positive_law: false
authority: "15 U.S.C. 78a et seq., ..."
cfr_part: "240"
---
```

**Federal Register:**
```yaml
---
identifier: "/us/fr/2026-06029"
source: "fr"
legal_status: "authoritative_unofficial"
title: "Meeting of the Advisory Board on Radiation and Worker Health"
document_number: "2026-06029"
document_type: "notice"
fr_citation: "91 FR 15619"
publication_date: "2026-03-30"
agencies:
  - "Health and Human Services Department"
  - "Centers for Disease Control and Prevention"
---
```

The `source` field discriminates content origin. The `legal_status` field indicates provenance: `"official_legal_evidence"` (positive law USC titles), `"official_prima_facie"` (non-positive law USC titles), or `"authoritative_unofficial"` (eCFR, FR).

### Metadata Indexes

Each directory includes a `_meta.json` sidecar file for programmatic access without parsing Markdown:

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

### Performance

| Corpus | Titles / Volume | Sections / Documents | Est. Tokens | Conversion Time |
|--------|-----------------|----------------------|-------------|-----------------|
| U.S. Code | 54 titles | ~60,000 sections | ~85M | ~20–30s |
| eCFR | 50 titles | ~227,000 sections | ~350M | ~60–90s |
| Federal Register | ~28–31k docs/year | ~750k+ docs (2000–present) | varies | ~1–2s per 1k docs |

SAX streaming keeps memory usage low, even when processing very large titles—some over 100MB of XML. The conversion step itself doesn’t involve any network I/O, so it’s entirely CPU-bound.

Federal Register documents are self-contained and handled one file at a time, and in practice, fetching them from the API usually takes longer than converting them

---

## Monorepo

LexBuild is a monorepo managed with [pnpm](https://pnpm.io/) workspaces and [Turborepo](https://turbo.build/).

```
lexbuild/
├── README.md          
├── CLAUDE.md          
├── package.json       
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json         
├── tsconfig.base.json 
├── eslint.config.js   
├── knip.jsonc         
├── CHANGELOG.md
├── CONTRIBUTING.md
├── ARCHITECTURE.md
├── packages/
│   ├── core/          # @lexbuild/core — XML parsing, AST, Markdown rendering
│   ├── usc/           # @lexbuild/usc  — U.S. Code converter and downloader
│   ├── ecfr/          # @lexbuild/ecfr — eCFR converter and downloader
│   ├── fr/            # @lexbuild/fr   — Federal Register converter and downloader
│   └── cli/           # @lexbuild/cli  — CLI binary
├── apps/
│   └── astro/         # LexBuild web app (https://lexbuild.dev)
├── docs/              
├── fixtures/          
├── downloads/         # Downloaded source data (gitignored)
├── output/            # Generated Markdown output (gitignored)
└── scripts/           
```

### Dependency Graph

```
@lexbuild/cli
  ├── @lexbuild/usc
  │     └── @lexbuild/core
  ├── @lexbuild/ecfr
  │     └── @lexbuild/core
  ├── @lexbuild/fr
  │     └── @lexbuild/core
  └── @lexbuild/core

@lexbuild/astro (No direct dependency on packages. Consumes converted output only.)
```

Source packages are independent — `@lexbuild/usc`, `@lexbuild/ecfr`, and `@lexbuild/fr` never import from each other. Future source packages follow the same pattern.

All internal dependencies use pnpm's `workspace:*` protocol. [Changesets](https://github.com/changesets/changesets) manages lockstep versioning across all published packages.

---

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@lexbuild/cli`](packages/cli/) | [![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcli)](https://www.npmjs.com/package/@lexbuild/cli) | CLI binary |
| [`@lexbuild/core`](packages/core/) | [![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcore)](https://www.npmjs.com/package/@lexbuild/core) | Shared XML parsing, AST, Markdown rendering |
| [`@lexbuild/usc`](packages/usc/) | [![npm](https://img.shields.io/npm/v/%40lexbuild%2Fusc)](https://www.npmjs.com/package/@lexbuild/usc) | United States Code |
| [`@lexbuild/ecfr`](packages/ecfr/) | [![npm](https://img.shields.io/npm/v/%40lexbuild%2Fecfr)](https://www.npmjs.com/package/@lexbuild/ecfr) | Code of Federal Regulations |
| [`@lexbuild/fr`](packages/fr/) | [![npm](https://img.shields.io/npm/v/%40lexbuild%2Ffr)](https://www.npmjs.com/package/@lexbuild/fr) | Federal Register |

Each package has its own README with full API documentation.

## Apps

| Package | Description |
|---------|-------------|
| [`@lexbuild/astro`](apps/astro/) | LexBuild web application |

[LexBuild](https://lexbuild.dev) is a server-rendered legal web resource and content browser built with Astro 6, React 19, Tailwind CSS 4, and shadcn/ui.

- **260,000+ section pages** across the U.S. Code and eCFR
- **Four granularity levels** — titles, chapters, parts (eCFR only), sections
- **Syntax-highlighted source** and rendered HTML preview
- **Sidebar navigation** with virtualized section lists
- **Full-text search** via Meilisearch
- **Dark mode** with system preference detection
- **Zero client JS by default** — interactive React islands only where needed

The web app consumes LexBuild's output (`.md` files and `_meta.json` sidecars) and has no code dependency on the conversion packages.

See [`apps/astro/README.md`](apps/astro/README.md) for setup and development instructions.

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
pnpm turbo build           # Build all packages
pnpm turbo test            # Run all tests
pnpm turbo lint            # Lint all packages
pnpm turbo typecheck       # Type-check all packages
pnpm turbo dev             # Watch mode
```

### Working on a Specific Package

```bash
pnpm turbo build --filter=@lexbuild/core
pnpm turbo test --filter=@lexbuild/ecfr

# Run the CLI locally
node packages/cli/dist/index.js download-usc --titles 1
node packages/cli/dist/index.js convert-usc --titles 1
node packages/cli/dist/index.js download-ecfr --titles 17
node packages/cli/dist/index.js convert-ecfr --titles 17
node packages/cli/dist/index.js download-fr --recent 7
node packages/cli/dist/index.js convert-fr --all
```

### Web App Development

```bash
# Build packages first
pnpm turbo build

# Download and convert some content
node packages/cli/dist/index.js download-usc --titles 1 && node packages/cli/dist/index.js convert-usc --titles 1
node packages/cli/dist/index.js download-ecfr --titles 1 && node packages/cli/dist/index.js convert-ecfr --titles 1

# Set up the web app
cd apps/astro
bash scripts/link-content.sh
npx tsx scripts/generate-nav.ts
pnpm dev
```

---

## Contributing

Contributions are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE)
