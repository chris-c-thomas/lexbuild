---
title: CLI Reference
description: Complete reference for every lexbuild command, flag, and option, including title specification format, input modes, granularity levels, link styles, and exit codes.
order: 1
---

This is the complete reference for the `lexbuild` command-line tool. Every command, flag, and option is documented here with tables and examples. Install via `npm install -g @lexbuild/cli` or use `npx @lexbuild/cli`.

For a quick-start guide, see the [CLI commands overview](/docs/cli/commands).

## Commands

The CLI uses a `{action}-{source}` naming pattern for download and convert commands, plus utility commands for inspecting data sources.

| Command | Description |
|---------|-------------|
| `download-usc` | Download U.S. Code XML from OLRC |
| `convert-usc` | Convert U.S. Code XML to Markdown |
| `list-release-points` | List available OLRC release points for the U.S. Code |
| `download-ecfr` | Download eCFR XML from ecfr.gov or govinfo |
| `convert-ecfr` | Convert eCFR XML to Markdown |
| `download-fr` | Download Federal Register XML and metadata from federalregister.gov |
| `convert-fr` | Convert Federal Register XML to Markdown |
| `enrich-fr` | Enrich FR Markdown frontmatter with API metadata |

Bare `download` and `convert` commands (without a source suffix) display an error prompting you to specify a source.

## Title Specification Format

The `--titles` option accepts a flexible format shared across all commands:

| Format | Example | Result |
|--------|---------|--------|
| Single number | `--titles 1` | Title 1 |
| Comma-separated | `--titles 1,3,8,11` | Titles 1, 3, 8, 11 |
| Range | `--titles 1-5` | Titles 1 through 5 |
| Mixed | `--titles 1-5,8,11` | Titles 1 through 5, plus 8 and 11 |

Valid title numbers: 1--54 for USC, 1--50 for eCFR. Duplicates are removed and results are sorted ascending.

---

## download-usc

Download U.S. Code XML from the Office of the Law Revision Counsel (OLRC).

```
lexbuild download-usc [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./downloads/usc/xml` | Download directory |
| `--titles <spec>` | -- | Title(s) to download (see format above) |
| `--all` | `false` | Download all 54 titles as a single bulk zip |
| `--release-point <id>` | auto-detected | OLRC release point identifier |

You must provide either `--titles` or `--all`.

The latest release point is auto-detected by scraping the OLRC download page. If auto-detection fails, a hardcoded fallback is used. The `--release-point` flag pins a specific release point and skips auto-detection.

### Examples

```bash
# Download a single title
lexbuild download-usc --titles 1

# Download specific titles
lexbuild download-usc --titles 1-5,8,11

# Download all 54 titles
lexbuild download-usc --all

# Custom output directory
lexbuild download-usc --all -o ./my-xml

# Pin a specific release point
lexbuild download-usc --all --release-point 119-73not60
```

---

## list-release-points

List available OLRC release points for the U.S. Code. This command fetches the current (latest) release point and the full history of prior releases, then displays them in a table with dates and affected titles.

```
lexbuild list-release-points [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-n, --limit <count>` | `20` | Maximum number of release points to show (0 = all) |

### Examples

```bash
# Show the 20 most recent release points
lexbuild list-release-points

# Show the 5 most recent
lexbuild list-release-points -n 5

# Show all available release points
lexbuild list-release-points -n 0
```

Use the release point ID from the output with `download-usc`:

```bash
lexbuild download-usc --all --release-point 119-72not60
```

---

## convert-usc

Convert U.S. Code XML files to Markdown.

```
lexbuild convert-usc [input] [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./output` | Output directory |
| `--titles <spec>` | -- | Title(s) to convert (see format above) |
| `--all` | `false` | Convert all downloaded titles found in `--input-dir` |
| `-i, --input-dir <dir>` | `./downloads/usc/xml` | Directory containing USC XML files |
| `-g, --granularity <level>` | `section` | Output granularity: `section`, `chapter`, or `title` |
| `--link-style <style>` | `plaintext` | Link style: `plaintext`, `relative`, or `canonical` |
| `--include-source-credits` | `true` | Include source credit annotations |
| `--no-include-source-credits` | -- | Exclude source credit annotations |
| `--include-notes` | `true` | Include all notes |
| `--no-include-notes` | -- | Exclude all notes |
| `--include-editorial-notes` | `false` | Include editorial notes only |
| `--include-statutory-notes` | `false` | Include statutory notes only |
| `--include-amendments` | `false` | Include amendment history notes only |
| `--dry-run` | `false` | Parse and report structure without writing files |
| `-v, --verbose` | `false` | Print detailed file output |

### Input Modes

You must specify exactly one of three mutually exclusive input modes:

| Mode | Usage | Description |
|------|-------|-------------|
| Positional argument | `lexbuild convert-usc ./path/to/usc01.xml` | Convert a single XML file |
| `--titles` | `lexbuild convert-usc --titles 1-5` | Convert titles by number from `--input-dir` |
| `--all` | `lexbuild convert-usc --all` | Discover and convert all titles in `--input-dir` |

### Granularity

Controls how many Markdown files are produced per title.

| Level | Flag | Output |
|-------|------|--------|
| Section (default) | `-g section` | One `.md` file per section |
| Chapter | `-g chapter` | One `.md` file per chapter, with sections inlined |
| Title | `-g title` | One `.md` file per title, with the entire hierarchy inlined |

### Link Styles

Controls how cross-references are rendered in the Markdown output.

| Style | Flag | Behavior |
|-------|------|----------|
| Plaintext (default) | `--link-style plaintext` | Citations rendered as plain text, no links |
| Relative | `--link-style relative` | Relative file path links within the output corpus |
| Canonical | `--link-style canonical` | Full URLs to the source website (uscode.house.gov) |

### Notes Filtering

By default, all notes (editorial, statutory, amendments) are included alongside the core legal text and source credits.

- `--no-include-notes` excludes all notes.
- Selective flags (`--include-editorial-notes`, `--include-statutory-notes`, `--include-amendments`) can be combined to include only specific note categories.
- When any selective flag is set, the broad `--include-notes` flag is automatically disabled to prevent conflicts.

### Examples

```bash
# Convert a single file
lexbuild convert-usc ./downloads/usc/xml/usc01.xml -o ./output

# Convert specific titles
lexbuild convert-usc --titles 1-5 -o ./output

# Convert all titles
lexbuild convert-usc --all -o ./output

# Chapter granularity with relative links
lexbuild convert-usc --titles 26 -g chapter --link-style relative -o ./output

# Title granularity (one file per title)
lexbuild convert-usc --titles 1 -g title -o ./output

# Only editorial notes
lexbuild convert-usc --titles 1 --include-editorial-notes -o ./output

# No notes at all
lexbuild convert-usc --titles 1 --no-include-notes -o ./output

# Dry run (parse and report, no files written)
lexbuild convert-usc --all --dry-run

# Verbose output (list every file written)
lexbuild convert-usc --titles 1 -v -o ./output
```

---

## download-ecfr

Download eCFR (Electronic Code of Federal Regulations) XML.

```
lexbuild download-ecfr [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./downloads/ecfr/xml` | Download directory |
| `--titles <spec>` | -- | Title(s) to download (see format above) |
| `--all` | `false` | Download all 50 eCFR titles |
| `--source <source>` | `ecfr-api` | Download source: `ecfr-api` or `govinfo` |
| `--date <YYYY-MM-DD>` | today | Point-in-time date (`ecfr-api` source only) |

You must provide either `--titles` or `--all`.

### Download Sources

| Source | Endpoint | Update Frequency |
|--------|----------|------------------|
| `ecfr-api` (default) | ecfr.gov versioner API | Daily |
| `govinfo` | govinfo.gov bulk XML | Irregular (can lag months) |

No API key is required for either source. Title 35 (Panama Canal) is reserved and silently skipped during `--all` downloads.

The `--date` option is only valid with `ecfr-api`. When omitted, the currency date is auto-detected from the eCFR API. If an import is in progress on the server, the downloader automatically falls back to the previous day's data.

### Examples

```bash
# Download specific titles from the eCFR API (default)
lexbuild download-ecfr --titles 1,17

# Download all 50 titles
lexbuild download-ecfr --all

# Download from govinfo bulk data
lexbuild download-ecfr --all --source govinfo

# Point-in-time download (specific date)
lexbuild download-ecfr --titles 17 --date 2025-01-01

# Custom output directory
lexbuild download-ecfr --all -o ./my-ecfr-xml
```

---

## convert-ecfr

Convert eCFR XML files to Markdown.

```
lexbuild convert-ecfr [input] [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./output` | Output directory |
| `--titles <spec>` | -- | Title(s) to convert (see format above) |
| `--all` | `false` | Convert all downloaded eCFR titles found in `--input-dir` |
| `-i, --input-dir <dir>` | `./downloads/ecfr/xml` | Directory containing eCFR XML files |
| `-g, --granularity <level>` | `section` | Output granularity: `section`, `part`, `chapter`, or `title` |
| `--link-style <style>` | `plaintext` | Link style: `plaintext`, `relative`, or `canonical` |
| `--include-source-credits` | `true` | Accepted but currently a no-op for eCFR |
| `--no-include-source-credits` | -- | Accepted but currently a no-op for eCFR |
| `--include-notes` | `true` | Include all notes |
| `--no-include-notes` | -- | Exclude all notes |
| `--include-editorial-notes` | `false` | Include editorial notes only |
| `--include-statutory-notes` | `false` | Include statutory/regulatory notes only |
| `--include-amendments` | `false` | Include amendment history notes only |
| `--dry-run` | `false` | Parse and report structure without writing files |
| `-v, --verbose` | `false` | Print detailed file output |

### Input Modes

You must specify exactly one of three mutually exclusive modes:

| Mode | Usage | Description |
|------|-------|-------------|
| Positional argument | `lexbuild convert-ecfr ./path/to/ECFR-title1.xml` | Convert a single XML file |
| `--titles` | `lexbuild convert-ecfr --titles 1-5` | Convert titles by number from `--input-dir` |
| `--all` | `lexbuild convert-ecfr --all` | Discover and convert all titles in `--input-dir` |

### Granularity

The eCFR converter supports an additional `part` level compared to the USC converter.

| Level | Flag | Output |
|-------|------|--------|
| Section (default) | `-g section` | One `.md` file per section |
| Part | `-g part` | One `.md` file per part, with sections inlined |
| Chapter | `-g chapter` | One `.md` file per chapter, with parts and sections inlined |
| Title | `-g title` | One `.md` file per title, with the entire hierarchy inlined |

### Link Styles

| Style | Flag | Behavior |
|-------|------|----------|
| Plaintext (default) | `--link-style plaintext` | Citations rendered as plain text, no links |
| Relative | `--link-style relative` | Relative file path links within the output corpus |
| Canonical | `--link-style canonical` | Full URLs to the source website (ecfr.gov) |

### Notes Filtering

Identical behavior to `convert-usc`. See the [notes filtering](#notes-filtering) section above.

### Examples

```bash
# Convert a single file
lexbuild convert-ecfr ./downloads/ecfr/xml/ECFR-title1.xml -o ./output

# Convert specific titles
lexbuild convert-ecfr --titles 17 -o ./output

# Convert all titles
lexbuild convert-ecfr --all -o ./output

# Part granularity (one file per CFR part)
lexbuild convert-ecfr --titles 17 -g part -o ./output

# Title granularity
lexbuild convert-ecfr --titles 1 -g title -o ./output

# Dry run
lexbuild convert-ecfr --all --dry-run
```

---

## download-fr

Download Federal Register documents (XML full text and JSON metadata) from the FederalRegister.gov API.

```
lexbuild download-fr [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./downloads/fr` | Download directory |
| `--from <YYYY-MM-DD>` | -- | Start date (inclusive) |
| `--to <YYYY-MM-DD>` | today | End date (inclusive) |
| `--types <types>` | all | Document types: `rule`, `proposed_rule`, `notice`, `presidential_document` |
| `--recent <days>` | -- | Download last N days (convenience shorthand) |
| `--document <number>` | -- | Download a single document by number |
| `--limit <n>` | -- | Maximum number of documents (for testing) |

You must provide one of `--from`, `--recent`, or `--document`.

Unlike USC and eCFR, the Federal Register is organized by date rather than by title. The downloader fetches both a `.json` metadata sidecar and a `.xml` full text file per document. Large date ranges are automatically chunked by month to stay under the API's 10,000-result cap per query.

No API key is required. Documents before January 2000 have JSON metadata but no XML full text and are skipped during download.

### Examples

```bash
# Download last 30 days of documents
lexbuild download-fr --recent 30

# Download a specific date range
lexbuild download-fr --from 2026-01-01 --to 2026-03-31

# Download only final rules
lexbuild download-fr --from 2026-01-01 --types rule

# Download rules and proposed rules
lexbuild download-fr --from 2026-01-01 --types rule,proposed_rule

# Download a single document by number
lexbuild download-fr --document 2026-06029

# Limit download for testing
lexbuild download-fr --from 2026-03-01 --limit 10
```

---

## convert-fr

Convert Federal Register XML files to Markdown.

```
lexbuild convert-fr [input] [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./output` | Output directory |
| `-i, --input-dir <dir>` | `./downloads/fr` | Directory containing downloaded FR files |
| `--all` | `false` | Convert all downloaded documents found in `--input-dir` |
| `--from <YYYY-MM-DD>` | -- | Filter: start date |
| `--to <YYYY-MM-DD>` | -- | Filter: end date |
| `--types <types>` | all | Filter: document types |
| `--link-style <style>` | `plaintext` | Link style: `plaintext`, `relative`, or `canonical` |
| `--dry-run` | `false` | Parse and report without writing files |
| `-v, --verbose` | `false` | Print detailed file output |

### Input Modes

| Mode | Usage | Description |
|------|-------|-------------|
| Positional argument | `lexbuild convert-fr ./path/to/doc.xml` | Convert a single XML file |
| `--all` | `lexbuild convert-fr --all` | Discover and convert all XML files in `--input-dir` |
| `--from` | `lexbuild convert-fr --from 2026-01-01` | Filter by date range within `--input-dir` |

There is no `--granularity` option because FR documents are already atomic (one file per document). There is no `--titles` option because the Federal Register is date-based, not title-based.

When a `.json` sidecar file exists alongside the `.xml` (same basename), frontmatter is enriched with structured agency, CFR reference, docket, and date information from the API.

### Examples

```bash
# Convert all downloaded documents
lexbuild convert-fr --all

# Convert a specific date range
lexbuild convert-fr --from 2026-01-01 --to 2026-03-31

# Convert only rules
lexbuild convert-fr --all --types rule

# Convert a single file
lexbuild convert-fr ./downloads/fr/2026/03/2026-06029.xml -o ./output

# Dry run
lexbuild convert-fr --all --dry-run
```

---

## enrich-fr

Enrich existing Federal Register Markdown files with metadata from the FederalRegister.gov API listing endpoint. This command patches YAML frontmatter in `.md` files that were originally converted from govinfo bulk XML, adding fields like `fr_citation`, `agencies`, `cfr_references`, `docket_ids`, `effective_date`, `comments_close_date`, and `fr_action` that are only available from the API's JSON metadata.

```
lexbuild enrich-fr [options]
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./output` | Output directory containing FR `.md` files |
| `--from <YYYY-MM-DD>` | -- | Start date (inclusive) |
| `--to <YYYY-MM-DD>` | today | End date (inclusive) |
| `--recent <days>` | -- | Enrich last N days (convenience shorthand) |
| `--force` | `false` | Overwrite files that already have `fr_citation` |

You must provide either `--from` or `--recent`.

The enricher paginates through the API listing endpoint (200 documents per page), matches each API document to its `.md` file by document number and publication date, and patches the YAML frontmatter. The Markdown body is preserved exactly as-is; no XML re-parsing or Markdown re-rendering occurs.

Files that already have `fr_citation` in their frontmatter are considered already enriched and skipped unless `--force` is used. This makes re-runs safe and incremental.

### Examples

```bash
# Enrich all govinfo-backfilled documents (2000 onward)
lexbuild enrich-fr --from 2000-01-01

# Enrich a specific date range
lexbuild enrich-fr --from 2020-01-01 --to 2025-12-31

# Enrich last 30 days
lexbuild enrich-fr --recent 30

# Force re-enrichment of already-enriched files
lexbuild enrich-fr --from 2026-01-01 --force

# Custom output directory
lexbuild enrich-fr --from 2000-01-01 -o ./my-output
```

---

## Combined Workflows

Full pipeline examples for downloading and converting from all sources.

```bash
# Full USC pipeline
lexbuild download-usc --all
lexbuild convert-usc --all -o ./output

# Full eCFR pipeline
lexbuild download-ecfr --all
lexbuild convert-ecfr --all -o ./output

# Specific titles from both sources
lexbuild download-usc --titles 1-5
lexbuild convert-usc --titles 1-5 -o ./output
lexbuild download-ecfr --titles 1-5
lexbuild convert-ecfr --titles 1-5 -o ./output

# Full FR pipeline (recent documents)
lexbuild download-fr --recent 30
lexbuild convert-fr --all -o ./output

# Backfill FR metadata from govinfo bulk
lexbuild download-fr --source govinfo --from 2000-01-01 --to 2025-12-31
lexbuild convert-fr --all -o ./output
lexbuild enrich-fr --from 2000-01-01 -o ./output

# Convert all sources with relative cross-reference links
lexbuild convert-usc --all --link-style relative -o ./output
lexbuild convert-ecfr --all --link-style relative -o ./output
lexbuild convert-fr --all --link-style relative -o ./output

# Browse prior release points and download a specific one
lexbuild list-release-points -n 10
lexbuild download-usc --all --release-point 119-72not60
```

## Output Directory Structure

The `-o` flag specifies the output root. The converter appends source subdirectories automatically:

- `convert-usc -o /path` writes to `/path/usc/...`
- `convert-ecfr -o /path` writes to `/path/ecfr/...`
- `convert-fr -o /path` writes to `/path/fr/...`

This means all converters can safely target the same output root without conflicts.

### USC Output Paths

| Granularity | Path Pattern |
|-------------|-------------|
| Section | `{output}/usc/title-{NN}/chapter-{NN}/section-{N}.md` |
| Chapter | `{output}/usc/title-{NN}/chapter-{NN}/chapter-{NN}.md` |
| Title | `{output}/usc/title-{NN}.md` |

### eCFR Output Paths

| Granularity | Path Pattern |
|-------------|-------------|
| Section | `{output}/ecfr/title-{NN}/chapter-{X}/part-{N}/section-{N.N}.md` |
| Part | `{output}/ecfr/title-{NN}/chapter-{X}/part-{N}.md` |
| Chapter | `{output}/ecfr/title-{NN}/chapter-{X}.md` |
| Title | `{output}/ecfr/title-{NN}.md` |

### FR Output Paths

| Path Pattern |
|-------------|
| `{output}/fr/{YYYY}/{MM}/{document_number}.md` |

FR documents are organized by publication date. Example: `{output}/fr/2026/03/2026-06029.md`. No granularity options since FR documents are always one file per document.

Title directories use zero-padded two-digit numbers (`title-01`). USC chapter directories are zero-padded (`chapter-01`). eCFR chapter directories use Roman numerals (`chapter-I`, `chapter-IV`). Section numbers are not zero-padded and may contain alphanumeric characters (e.g., `section-240.10b-5.md`).

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (invalid options, missing files, download failure, or conversion error) |
