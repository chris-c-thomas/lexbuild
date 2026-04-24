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
3. **Enrich** (FR govinfo bulk only) the converted files with additional API metadata

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
| `--granularities <list>` | -- | Comma-separated granularities for single-pass multi-granularity output. Mutually exclusive with `-g`. |
| `--output-chapter <dir>` | -- | Output directory for chapter granularity (when using `--granularities`) |
| `--output-title <dir>` | -- | Output directory for title granularity (when using `--granularities`) |
| `--output-part <dir>` | -- | Output directory for part granularity, eCFR only (when using `--granularities`) |
| `--link-style <style>` | `plaintext` | Cross-reference link style: `plaintext`, `relative`, or `canonical` |
| `--dry-run` | off | Parse and report statistics without writing files |
| `-v, --verbose` | off | Print detailed output including file paths |
| `--include-notes` / `--no-include-notes` | on | Include or exclude all notes |
| `--include-editorial-notes` | off | Include only editorial notes |
| `--include-statutory-notes` | off | Include only statutory notes |
| `--include-amendments` | off | Include only amendment history |

> [!NOTE]
> Setting any selective note flag (`--include-editorial-notes`, `--include-statutory-notes`, `--include-amendments`) automatically disables the broad `--include-notes` flag.

### Multi-Granularity Single-Pass Mode

Use `--granularities` to emit several granularity levels from a single parse of the source XML. Each listed granularity needs a matching output directory — section uses `--output` (or `--output-section`); chapter, title, and part (eCFR only) each take their own `--output-<granularity>` flag.

```bash
# USC: three granularities in one parse
lexbuild convert-usc --all \
  --granularities section,title,chapter \
  --output ./output \
  --output-title ./output-title \
  --output-chapter ./output-chapter

# eCFR: four granularities in one parse
lexbuild convert-ecfr --all \
  --granularities section,title,chapter,part \
  --output ./output \
  --output-title ./output-title \
  --output-chapter ./output-chapter \
  --output-part ./output-part
```

`--granularities` is mutually exclusive with `-g/--granularity`. The builder parses the XML once and emits at every requested level, so multi-granularity runs are roughly ~40–50% faster than N separate single-granularity invocations.

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
# Download the last 30 days of FR documents (XML + JSON from FR API)
lexbuild download-fr --recent 30

# Convert all downloaded documents (JSON sidecar used automatically for rich frontmatter)
lexbuild convert-fr --all
```

> [!NOTE]
> The `enrich-fr` step is only needed when using `--source govinfo` (bulk XML without JSON metadata). The default `fr-api` source downloads both XML and JSON, so the converter produces rich frontmatter automatically.

## Update Scripts

A single orchestrator handles change detection, download, convert, and deploy across all sources. Default is incremental from each source's last checkpoint:

```bash
./scripts/update.sh                                # All sources, incremental from checkpoints
./scripts/update.sh --source fr                    # One source
./scripts/update.sh --source ecfr,fr               # Multi-source
./scripts/update.sh --source ecfr --titles 1,17    # eCFR titles 1, 17 only
./scripts/update.sh --source fr --days 7           # FR last 7 days
./scripts/update.sh --source usc --force           # USC full redownload + reconvert
./scripts/update.sh --skip-deploy                  # Local pipeline only
./scripts/update.sh --dry-run                      # Print plan, exit 0
```

`update-usc.sh` and `update-ecfr.sh` convert all granularities in one call using `--granularities` (see above), so the convert step parses the XML once per title rather than once per granularity. See [Incremental Updates](/docs/guides/bulk-download#incremental-updates) for details on checkpoints and bootstrap behavior.

## Getting Help

Every command supports `--help` for a full description of its options and usage examples:

```bash
lexbuild convert-usc --help
lexbuild download-ecfr --help
```

For complete flag tables and option details, see the [CLI Reference](/docs/reference/cli-reference).
