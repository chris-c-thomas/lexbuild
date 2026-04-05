---
title: "Commands"
description: "Overview of LexBuild CLI commands with common workflows, title specification syntax, and shared options."
order: 2
---

# Commands

Every LexBuild command follows the `{action}-{source}` naming pattern. The action describes what to do (download, convert, enrich) and the source identifies the legal dataset.

## Command Summary

| Command | Description |
|---|---|
| `download-usc` | Download U.S. Code XML from the OLRC |
| `convert-usc` | Convert U.S. Code XML to Markdown |
| `list-release-points` | List available OLRC release points |
| `download-ecfr` | Download eCFR XML from ecfr.gov or govinfo |
| `convert-ecfr` | Convert eCFR XML to Markdown |
| `download-fr` | Download Federal Register XML and JSON metadata |
| `convert-fr` | Convert Federal Register XML to Markdown |
| `enrich-fr` | Patch FR Markdown frontmatter with API metadata |

Running `lexbuild download` or `lexbuild convert` without a source suffix prints an error listing the available source-specific commands.

## Common Workflow

Each source follows the same general pattern:

1. **Download** the raw XML from the official source
2. **Convert** the XML into structured Markdown files
3. **Enrich** (FR only) the converted files with additional API metadata

## Title Specification

The `--titles` flag accepts flexible input for selecting which titles to process. This applies to USC and eCFR commands.

| Format | Example | Selects |
|---|---|---|
| Single number | `--titles 1` | Title 1 |
| Comma-separated | `--titles 1,5,11` | Titles 1, 5, and 11 |
| Range | `--titles 1-5` | Titles 1 through 5 |
| Mixed | `--titles 1-5,8,11` | Titles 1 through 5, plus 8 and 11 |

Use `--all` instead of `--titles` to process every available title.

## Shared Options

These flags are available on all convert commands:

| Flag | Default | Description |
|---|---|---|
| `-o, --output <dir>` | `./output` | Output directory for converted Markdown |
| `-g, --granularity <level>` | `section` | Output granularity (varies by source) |
| `--link-style <style>` | `plaintext` | Cross-reference link style: `plaintext`, `relative`, or `canonical` |
| `--dry-run` | off | Parse and report statistics without writing files |
| `-v, --verbose` | off | Print detailed output including file paths |
| `--include-notes` / `--no-include-notes` | on | Include or exclude all notes |
| `--include-editorial-notes` | off | Include only editorial notes |
| `--include-statutory-notes` | off | Include only statutory notes |
| `--include-amendments` | off | Include only amendment history |

> [!NOTE]
> Setting any selective note flag (`--include-editorial-notes`, `--include-statutory-notes`, `--include-amendments`) automatically disables the broad `--include-notes` flag.

## Full Pipeline Examples

### U.S. Code

```bash
# Download all 54 titles
lexbuild download-usc --all

# Convert all titles to Markdown
lexbuild convert-usc --all
```

### eCFR

```bash
# Download all 50 titles from the eCFR API
lexbuild download-ecfr --all

# Convert all titles to Markdown
lexbuild convert-ecfr --all
```

### Federal Register

```bash
# Download the last 30 days of FR documents
lexbuild download-fr --recent 30

# Convert all downloaded documents
lexbuild convert-fr --all

# Enrich frontmatter with API metadata
lexbuild enrich-fr --recent 30
```

## Getting Help

Every command supports `--help` for a full description of its options and usage examples:

```bash
lexbuild convert-usc --help
lexbuild download-ecfr --help
```

For complete flag tables and option details, see the [CLI Reference](/docs/reference/cli-reference).
