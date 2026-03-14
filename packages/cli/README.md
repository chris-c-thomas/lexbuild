# @lexbuild/cli

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcli?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/chris-c-thomas/LexBuild/ci.yml?style=for-the-badge&label=CI)](https://github.com/chris-c-thomas/LexBuild/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/chris-c-thomas/LexBuild?style=for-the-badge)](https://github.com/chris-c-thomas/LexBuild)

This package is part of the [LexBuild monorepo](https://github.com/chris-c-thomas/LexBuild), a tool that converts U.S. legal XML into structured Markdown optimized for AI, RAG pipelines, and semantic search. See the monorepo for full documentation, architecture details, and contribution guidelines.

It provides the CLI entry point for downloading and converting legal texts. Built on [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) for shared parsing and rendering infrastructure, [`@lexbuild/usc`](https://www.npmjs.com/package/@lexbuild/usc) for [United States Code](https://uscode.house.gov/) support, and [`@lexbuild/ecfr`](https://www.npmjs.com/package/@lexbuild/ecfr) for [eCFR](https://www.ecfr.gov/) (Code of Federal Regulations) support.

## Install

Install globally

```bash
npm install -g @lexbuild/cli
```

Run directly with npx:

```bash
npx @lexbuild/cli download-usc --all
npx @lexbuild/cli convert-usc --all
```

## Quick Start

### U.S. Code

```bash
# Download and convert all 54 titles
lexbuild download-usc --all && lexbuild convert-usc --all

# Start small — download and convert Title 1
lexbuild download-usc --titles 1 && lexbuild convert-usc --titles 1

# Download and convert a range
lexbuild download-usc --titles 1-5 && lexbuild convert-usc --titles 1-5
```

### eCFR (Code of Federal Regulations)

```bash
# Download and convert all 50 titles
lexbuild download-ecfr --all && lexbuild convert-ecfr --all

# Download and convert a single title
lexbuild download-ecfr --titles 17 && lexbuild convert-ecfr --titles 17
```

## Commands

### U.S. Code

#### `lexbuild download-usc`

Fetch U.S. Code XML files from the OLRC.

```bash
lexbuild download-usc --titles 1           # Single title
lexbuild download-usc --titles 1-5,8,11    # Range + specific titles
lexbuild download-usc --all                # All 54 titles (single bulk zip)
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s) to download: `1`, `1-5`, `1-5,8,11` |
| `--all` | — | Download all 54 titles |
| `-o, --output <dir>` | `./downloads/usc/xml` | Output directory |
| `--release-point <id>` | current | OLRC release point |

#### `lexbuild convert-usc`

Convert downloaded USC XML to Markdown.

```bash
lexbuild convert-usc --titles 1                          # By title number
lexbuild convert-usc --all                               # All downloaded titles
lexbuild convert-usc ./downloads/usc/xml/usc01.xml       # Direct file path
lexbuild convert-usc --titles 1 -g chapter               # Chapter-level output
lexbuild convert-usc --titles 1 -g title                 # Title-level output (single file)
lexbuild convert-usc --titles 1 --link-style canonical   # OLRC website links
lexbuild convert-usc --titles 42 --dry-run               # Preview without writing
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s) to convert |
| `--all` | — | Convert all titles in input directory |
| `-i, --input-dir <dir>` | `./downloads/usc/xml` | Input directory for XML files |
| `-o, --output <dir>` | `./output` | Output directory |
| `-g, --granularity <level>` | `section` | `section`, `chapter`, or `title` |
| `--link-style <style>` | `plaintext` | `plaintext`, `canonical`, or `relative` |
| `--no-include-source-credits` | — | Exclude source credits |
| `--no-include-notes` | — | Exclude all notes |
| `--include-editorial-notes` | — | Include editorial notes only |
| `--include-statutory-notes` | — | Include statutory notes only |
| `--include-amendments` | — | Include amendment notes only |
| `--dry-run` | — | Parse and report without writing files |
| `-v, --verbose` | — | Verbose logging |

### eCFR (Code of Federal Regulations)

#### `lexbuild download-ecfr`

Fetch eCFR XML files from govinfo.

```bash
lexbuild download-ecfr --titles 17        # Single title
lexbuild download-ecfr --titles 1-5,17    # Range + specific titles
lexbuild download-ecfr --all              # All 50 titles
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s) to download: `1`, `1-5`, `1-5,17` |
| `--all` | — | Download all 50 titles |
| `-o, --output <dir>` | `./downloads/ecfr/xml` | Output directory |

#### `lexbuild convert-ecfr`

Convert downloaded eCFR XML to Markdown.

```bash
lexbuild convert-ecfr --titles 17                             # By title number
lexbuild convert-ecfr --all                                   # All downloaded titles
lexbuild convert-ecfr ./downloads/ecfr/xml/ECFR-title17.xml   # Direct file path
lexbuild convert-ecfr --titles 17 -g part                     # Part-level output
lexbuild convert-ecfr --titles 17 -g title                    # Title-level output
lexbuild convert-ecfr --all --dry-run                         # Preview without writing
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s) to convert |
| `--all` | — | Convert all titles in input directory |
| `-i, --input-dir <dir>` | `./downloads/ecfr/xml` | Input directory for XML files |
| `-o, --output <dir>` | `./output` | Output directory |
| `-g, --granularity <level>` | `section` | `section`, `part`, `chapter`, or `title` |
| `--link-style <style>` | `plaintext` | `plaintext`, `canonical`, or `relative` |
| `--no-include-source-credits` | — | Exclude source credits |
| `--no-include-notes` | — | Exclude all notes |
| `--include-editorial-notes` | — | Include editorial notes only |
| `--include-statutory-notes` | — | Include statutory/regulatory notes only |
| `--include-amendments` | — | Include amendment notes only |
| `--dry-run` | — | Parse and report without writing files |
| `-v, --verbose` | — | Verbose logging |

## Output

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

Each file includes YAML frontmatter with source-specific metadata (`source`, `legal_status`, identifier, hierarchy context) followed by the legal text. Section and chapter/part granularities also generate `_meta.json` sidecar files and `README.md` summaries per title.

## Performance

The full U.S. Code — all 54 titles, 60,000+ sections, ~85 million estimated tokens — converts in about 20-30 seconds on modern machines. SAX streaming keeps memory bounded for even the largest titles (100MB+ XML).

## License

[MIT](https://github.com/chris-c-thomas/LexBuild/blob/main/LICENSE)
