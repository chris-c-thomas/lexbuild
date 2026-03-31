# @lexbuild/cli

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcli?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/chris-c-thomas/LexBuild/ci.yml?style=for-the-badge&label=CI)](https://github.com/chris-c-thomas/LexBuild/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/chris-c-thomas/LexBuild?style=for-the-badge)](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)

Download and convert U.S. legal XML into structured Markdown optimized for AI, RAG pipelines, and semantic search. Supports the [U.S. Code](https://uscode.house.gov/) (54 titles, 60,000+ sections), the [eCFR](https://www.ecfr.gov/) (50 titles, 200,000+ sections), and the [Federal Register](https://www.federalregister.gov/) (~30,000 documents/year).

## Install

```bash
# Global install
npm install -g @lexbuild/cli

# Or run directly
npx @lexbuild/cli --help
```

## Quick Start

```bash
# U.S. Code — download and convert all 54 titles
lexbuild download-usc --all
lexbuild convert-usc --all

# eCFR — download and convert all 50 titles
lexbuild download-ecfr --all
lexbuild convert-ecfr --all

# Federal Register — download and convert recent documents
lexbuild download-fr --recent 30
lexbuild convert-fr --all

# Start small — a single title or document
lexbuild download-usc --titles 1 && lexbuild convert-usc --titles 1
lexbuild download-ecfr --titles 17 && lexbuild convert-ecfr --titles 17
lexbuild download-fr --document 2026-06029 && lexbuild convert-fr --all
```

## Commands

### `download-usc`

Download U.S. Code XML from the OLRC. Auto-detects the latest release point.

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
| `-v, --verbose` | — | Verbose file output |

### `list-release-points`

List available OLRC release points for the U.S. Code. Shows the latest release point and a table of prior releases with dates and affected titles.

```bash
lexbuild list-release-points                     # 20 most recent
lexbuild list-release-points -n 5                # 5 most recent
lexbuild list-release-points -n 0                # All available
```

| Option | Default | Description |
|--------|---------|-------------|
| `-n, --limit <count>` | `20` | Max release points to show (0 = all) |

Use the release point ID with `download-usc --release-point <id>` to download a specific version.

### `download-ecfr`

Download eCFR XML. Defaults to the ecfr.gov API (daily-updated); govinfo bulk data available as fallback.

```bash
lexbuild download-ecfr --all                                 # All 50 titles (eCFR API)
lexbuild download-ecfr --titles 1-5,17                       # Specific titles
lexbuild download-ecfr --all --date 2026-01-01               # Point-in-time download
lexbuild download-ecfr --all --source govinfo                # Govinfo bulk fallback
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s): `1`, `1-5`, `1-5,17` |
| `--all` | — | Download all 50 titles |
| `-o, --output <dir>` | `./downloads/ecfr/xml` | Output directory |
| `--source` | `ecfr-api` | `ecfr-api` (daily) or `govinfo` (bulk) |
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
| `-v, --verbose` | — | Verbose file output |

### `download-fr`

Download Federal Register XML and metadata from the FederalRegister.gov API.

```bash
lexbuild download-fr --recent 30                                    # Last 30 days
lexbuild download-fr --from 2026-01-01 --to 2026-03-31              # Date range
lexbuild download-fr --from 2026-01-01 --types rule,proposed_rule   # Filter by type
lexbuild download-fr --document 2026-06029                          # Single document
```

| Option | Default | Description |
|--------|---------|-------------|
| `--from <YYYY-MM-DD>` | — | Start date (inclusive) |
| `--to <YYYY-MM-DD>` | today | End date (inclusive) |
| `--recent <days>` | — | Download last N days |
| `--document <number>` | — | Download single document by number |
| `-o, --output <dir>` | `./downloads/fr` | Output directory |
| `--types` | all | `rule`, `proposed_rule`, `notice`, `presidential_document` |
| `--limit <n>` | — | Max documents (for testing) |

### `convert-fr`

Convert downloaded FR XML to Markdown.

```bash
lexbuild convert-fr --all                                           # All downloaded documents
lexbuild convert-fr --from 2026-01-01 --to 2026-03-31               # Filter by date range
lexbuild convert-fr --all --types rule                               # Filter by type
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
| `-v, --verbose` | — | Verbose file output |

## Output Structure

### U.S. Code

| Granularity | Example Path |
|---|---|
| `section` (default) | `output/usc/title-01/chapter-01/section-1.md` |
| `chapter` | `output/usc/title-01/chapter-01/chapter-01.md` |
| `title` | `output/usc/title-01.md` |

### eCFR

| Granularity | Example Path |
|---|---|
| `section` (default) | `output/ecfr/title-17/chapter-IV/part-240/section-240.10b-5.md` |
| `part` | `output/ecfr/title-17/chapter-IV/part-240.md` |
| `chapter` | `output/ecfr/title-17/chapter-IV/chapter-IV.md` |
| `title` | `output/ecfr/title-17.md` |

### Federal Register

| Example Path |
|---|
| `output/fr/2026/03/2026-06029.md` |

FR documents are atomic — one file per document, organized by year and month. No granularity options.

Every file includes YAML frontmatter with source metadata (`source`, `legal_status`, identifier, hierarchy context) followed by the legal text in Markdown. Section and chapter/part granularities generate `_meta.json` sidecar files and `README.md` summaries per title.

## Performance

The full U.S. Code — all 54 titles, 60,000+ sections, ~85 million estimated tokens — converts in about 20–30 seconds on modern hardware. SAX streaming keeps memory bounded for even the largest titles (100MB+ XML).

## Compatibility

- **Node.js** >= 22
- **ESM only** — no CommonJS build

## Monorepo Context

This is the published CLI for the [LexBuild](https://github.com/chris-c-thomas/LexBuild) monorepo. It depends on [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core), [`@lexbuild/usc`](https://www.npmjs.com/package/@lexbuild/usc), [`@lexbuild/ecfr`](https://www.npmjs.com/package/@lexbuild/ecfr), and [`@lexbuild/fr`](https://www.npmjs.com/package/@lexbuild/fr) for all conversion and download logic.

```bash
pnpm turbo build --filter=@lexbuild/cli
pnpm turbo typecheck --filter=@lexbuild/cli
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) | Shared parsing, AST, and rendering infrastructure |
| [`@lexbuild/usc`](https://www.npmjs.com/package/@lexbuild/usc) | U.S. Code converter — programmatic API |
| [`@lexbuild/ecfr`](https://www.npmjs.com/package/@lexbuild/ecfr) | eCFR converter — programmatic API |
| [`@lexbuild/fr`](https://www.npmjs.com/package/@lexbuild/fr) | Federal Register converter — programmatic API |

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
