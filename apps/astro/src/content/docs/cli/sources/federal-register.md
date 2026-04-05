---
title: "Federal Register"
description: "Download, convert, and enrich Federal Register documents using the LexBuild CLI."
order: 5
---

# Federal Register

The Federal Register (FR) is the daily journal of the United States government, publishing federal agency rules, proposed rules, notices, and presidential documents. Unlike the U.S. Code and eCFR, which are organized by title, the Federal Register is organized by date and document number.

## Document Types

The Federal Register publishes four types of documents:

| Type | CLI Value | Description |
|---|---|---|
| Rule | `rule` | Final rules and regulations |
| Proposed Rule | `proposed_rule` | Notices of proposed rulemaking (NPRMs) |
| Notice | `notice` | Agency notices and announcements |
| Presidential Document | `presidential_document` | Executive orders, memoranda, proclamations |

## Download

Download FR documents with `download-fr`. Unlike USC and eCFR, FR downloads are date-based rather than title-based.

Download recent documents:

```bash
lexbuild download-fr --recent 30
```

Download a date range:

```bash
lexbuild download-fr --from 2026-01-01 --to 2026-03-31
```

Download a single document by its document number:

```bash
lexbuild download-fr --document 2026-06029
```

Filter by document type:

```bash
lexbuild download-fr --recent 30 --types rule
lexbuild download-fr --from 2026-01-01 --types rule,proposed_rule
```

### Download Sources

Two download sources are available:

| Source | Description |
|---|---|
| `fr-api` (default) | Per-document XML + JSON metadata from FederalRegister.gov API |
| `govinfo` | Bulk daily-issue XML from govinfo.gov (faster for historical backfill) |

```bash
# Default: per-document from FederalRegister.gov API
lexbuild download-fr --from 2026-01-01

# Bulk daily issues from govinfo (better for large historical ranges)
lexbuild download-fr --source govinfo --from 2000-01-01 --to 2025-12-31
```

Each document downloaded from the FR API includes both an XML file (full text) and a JSON file (API metadata). Files are saved to `./downloads/fr/` organized by year and month.

### Download Options

| Flag | Description |
|---|---|
| `--from <YYYY-MM-DD>` | Start date (inclusive) |
| `--to <YYYY-MM-DD>` | End date (inclusive, defaults to today) |
| `--recent <days>` | Download the last N days |
| `--document <number>` | Download a single document by number |
| `--types <types>` | Filter by document type (comma-separated) |
| `--limit <n>` | Maximum number of documents (FR API only) |
| `--concurrency <n>` | Number of concurrent downloads (default: 10) |

## Convert

Convert downloaded XML files to Markdown with `convert-fr`.

Convert all downloaded documents:

```bash
lexbuild convert-fr --all
```

Convert documents within a date range:

```bash
lexbuild convert-fr --from 2026-01-01 --to 2026-03-31
```

Filter by document type during conversion:

```bash
lexbuild convert-fr --all --types rule
```

Convert a single XML file by path:

```bash
lexbuild convert-fr ./downloads/fr/2026/03/2026-06029.xml
```

> [!NOTE]
> FR documents are atomic -- there is no granularity option. Each document produces a single `.md` file.

## Enrich

The `enrich-fr` command patches YAML frontmatter in existing `.md` files with rich metadata from the FederalRegister.gov API. This is especially useful for documents originally downloaded from govinfo, which lack metadata like agency names, CFR references, and docket IDs.

```bash
lexbuild enrich-fr --from 2000-01-01
lexbuild enrich-fr --recent 30
```

Force re-enrichment of files that have already been enriched:

```bash
lexbuild enrich-fr --from 2020-01-01 --force
```

The enrich step does not re-parse XML or re-render Markdown. It only fetches metadata from the API and updates the YAML frontmatter block. Files that already contain an `fr_citation` field are skipped unless `--force` is used.

## Full Pipeline

The complete FR workflow involves three steps:

```bash
# 1. Download XML and JSON metadata
lexbuild download-fr --from 2026-01-01

# 2. Convert XML to Markdown
lexbuild convert-fr --all

# 3. Enrich frontmatter with API metadata
lexbuild enrich-fr --from 2026-01-01
```

## Output Structure

FR output is organized by year and month:

```
output/fr/
  2026/
    01/
      2026-00123.md
      2026-00456.md
    02/
      2026-01234.md
      ...
    03/
      2026-06029.md
      ...
```

Each document number is unique and corresponds to a single Markdown file. There are no `_meta.json` or `README.md` sidecar files for FR output.

## Further Reading

- [Output Format](/docs/cli/output-format) -- Frontmatter schema and FR-specific fields
- [Configuration](/docs/cli/configuration) -- Link styles and output directories
- [CLI Reference](/docs/reference/cli-reference) -- Complete flag tables for all FR commands
