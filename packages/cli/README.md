# @lexbuild/cli

[![npm](https://img.shields.io/npm/v/%40lexbuild%2Fcli?style=for-the-badge)](https://www.npmjs.com/package/@lexbuild/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/chris-c-thomas/lexbuild/ci.yml?style=for-the-badge&label=CI)](https://github.com/chris-c-thomas/lexbuild/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/chris-c-thomas/lexbuild?style=for-the-badge)](https://github.com/chris-c-thomas/lexbuild)

This package is part of the [LexBuild](https://github.com/chris-c-thomas/lexbuild) monorepo, a tool that converts U.S. legislative XML into structured Markdown optimized for AI, RAG pipelines, and semantic search. See the monorepo for full documentation, architecture details, and contribution guidelines.

It provides the CLI entry point for downloading and converting legal and civic texts. Built on [`@lexbuild/core`](https://www.npmjs.com/package/@lexbuild/core) for shared parsing and rendering infrastructure, and also [`@lexbuild/usc`](https://www.npmjs.com/package/@lexbuild/usc) for [United States Code](https://uscode.house.gov/) support. Implementing support for additional sources (CFR, state statutes) is planned.

## Install

Install globally

```bash
npm install -g @lexbuild/cli
```

Run directly with npx:

```bash
npx @lexbuild/cli download --all
npx @lexbuild/cli convert --all
```

## Quick Start

```bash
# Download and convert all 54 titles
lexbuild download --all && lexbuild convert --all

# Start small — download and convert Title 1
lexbuild download --titles 1 && lexbuild convert --titles 1

# Download and convert a range
lexbuild download --titles 1-5 && lexbuild convert --titles 1-5
```

## Commands

### `lexbuild download`

Fetch U.S. Code XML files from the OLRC.

```bash
lexbuild download --titles 1           # Single title
lexbuild download --titles 1-5,8,11    # Range + specific titles
lexbuild download --all                # All 54 titles (single bulk zip)
```

| Option | Default | Description |
|--------|---------|-------------|
| `--titles <spec>` | — | Title(s) to download: `1`, `1-5`, `1-5,8,11` |
| `--all` | — | Download all 54 titles |
| `-o, --output <dir>` | `./downloads/usc/xml` | Output directory |
| `--release-point <id>` | current | OLRC release point |

### `lexbuild convert`

Convert downloaded XML to Markdown.

```bash
lexbuild convert --titles 1                          # By title number
lexbuild convert --all                               # All downloaded titles
lexbuild convert ./downloads/usc/xml/usc01.xml       # Direct file path
lexbuild convert --titles 1 -g chapter               # Chapter-level output
lexbuild convert --titles 1 -g title                 # Title-level output (single file)
lexbuild convert --titles 1 --link-style canonical   # OLRC website links
lexbuild convert --titles 42 --dry-run               # Preview without writing
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

## Output

**Section granularity** (default):

```
output/usc/title-01/chapter-01/section-1.md
```

**Chapter granularity** (`-g chapter`):

```
output/usc/title-01/chapter-01.md
```

**Title granularity** (`-g title`):

```
output/usc/title-01.md
```

Each file includes YAML frontmatter (identifier, title, chapter, section, status, source credit) followed by the statutory text with bold inline numbering. Title-level output includes enriched frontmatter with `chapter_count`, `section_count`, and `total_token_estimate`.

## Performance

The full U.S. Code — all 54 titles, 60,000+ sections, ~85 million estimated tokens — converts in about 20-30 seconds on modern machines. SAX streaming keeps memory bounded for even the largest titles (100MB+ XML).

## Documentation

- [LexBuild Monorepo](https://github.com/chris-c-thomas/lexbuild)
- [Architecture](https://github.com/chris-c-thomas/lexbuild/blob/main/docs/architecture.md)
- [Output Format](https://github.com/chris-c-thomas/lexbuild/blob/main/docs/output-format.md)
- [XML Element Reference](https://github.com/chris-c-thomas/lexbuild/blob/main/docs/xml-element-reference.md)
- [Extending](https://github.com/chris-c-thomas/lexbuild/blob/main/docs/extending.md)

## License

[MIT](https://github.com/chris-c-thomas/lexbuild/blob/main/LICENSE)
