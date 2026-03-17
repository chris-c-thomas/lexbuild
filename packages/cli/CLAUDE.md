# CLAUDE.md — @lexbuild/cli

## Package Overview

`@lexbuild/cli` is the published npm package that users install (`npm install -g @lexbuild/cli`). It provides the `lexbuild` binary with source-specific download and convert commands. The CLI is a thin orchestration layer — all conversion and download logic lives in the source packages (`@lexbuild/usc`, `@lexbuild/ecfr`).

## Module Structure

```
src/
├── index.ts                    # Entry point — Commander program setup, registers commands
├── ui.ts                       # Terminal UI utilities (spinners, tables, formatters)
├── parse-titles.ts             # Title specification parser ("1-5,8,11" → number[])
└── commands/
    ├── download-usc.ts         # lexbuild download-usc command
    ├── convert-usc.ts          # lexbuild convert-usc command
    ├── download-ecfr.ts        # lexbuild download-ecfr command
    └── convert-ecfr.ts         # lexbuild convert-ecfr command
```

## Commands

### `lexbuild download-usc`

Downloads USC XML from OLRC. Calls `downloadTitles()` from `@lexbuild/usc`. Auto-detects the latest OLRC release point by scraping the download page; falls back to `FALLBACK_RELEASE_POINT` if detection fails.

```
Options:
  --output <dir>           Default: "./downloads/usc/xml"
  --titles <spec>          Title selection: "1", "1-5", "1-5,8,11"
  --all                    Download all 54 titles (single bulk zip)
  --release-point <id>     Pin a specific release point (auto-detected if omitted)
```

Requires either `--titles` or `--all`. Summary output shows `(auto-detected)` when the release point was detected at runtime.

### `lexbuild convert-usc`

Converts USC XML to Markdown. Calls `convertTitle()` from `@lexbuild/usc`.

```
Arguments:
  [input]                  Path to single USC XML file (optional)

Options:
  --output <dir>           Default: "./output"
  --titles <spec>          Title selection
  --all                    Discover & convert all titles in --input-dir
  --input-dir <dir>        Default: "./downloads/usc/xml"
  -g, --granularity        section | chapter | title (default: section)
  --link-style             relative | canonical | plaintext (default: plaintext)
  --include-source-credits Default: true
  --include-notes          Default: true (all notes)
  --include-editorial-notes
  --include-statutory-notes
  --include-amendments
  --dry-run                Parse only, no files written
  -v, --verbose            Print detailed file output
```

Three input modes (mutually exclusive): `<input>` positional arg, `--titles`, or `--all`.

**Note flag logic**: If any selective note flag is set (`--include-editorial-notes`, etc.), the broad `--include-notes` flag is automatically disabled to prevent conflicts.

### `lexbuild download-ecfr`

Downloads eCFR XML. Defaults to the ecfr.gov API (daily-updated); govinfo bulk data available as fallback via `--source govinfo`.

```
Options:
  --output <dir>           Default: "./downloads/ecfr/xml"
  --titles <spec>          Title selection: "1", "1-5", "1-5,17"
  --all                    Download all 50 titles
  --source <source>        ecfr-api (default, daily-updated) or govinfo (bulk)
  --date <YYYY-MM-DD>      Point-in-time date (ecfr-api only)
```

When using `ecfr-api` source, the currency date is auto-detected from `/api/versioner/v1/titles` unless `--date` is specified. Output files use the same naming (`ECFR-title{N}.xml`) regardless of source, so `convert-ecfr` works identically with either.

### `lexbuild convert-ecfr`

Converts eCFR XML to Markdown. Calls `convertEcfrTitle()` from `@lexbuild/ecfr`.

```
Arguments:
  [input]                  Path to single eCFR XML file (optional)

Options:
  --output <dir>           Default: "./output"
  --titles <spec>          Title selection
  --all                    Discover & convert all titles in --input-dir
  --input-dir <dir>        Default: "./downloads/ecfr/xml"
  -g, --granularity        section | part | chapter | title (default: section)
  --link-style             relative | canonical | plaintext (default: plaintext)
  --include-source-credits Default: true
  --include-notes          Default: true (all notes)
  --include-editorial-notes
  --include-statutory-notes
  --include-amendments
  --dry-run                Parse only, no files written
  -v, --verbose            Print detailed file output
```

### Bare `download` / `convert`

Running `lexbuild download` or `lexbuild convert` without a source suffix prints an error listing available source-specific commands and exits with code 1.

## UI Module (`ui.ts`)

Provides consistent terminal output:

- **`createSpinner(text)`** — Ora spinner with "dots" animation
- **`formatDuration(ms)`** — `"1.5s"` or `"1m 23s"`
- **`formatBytes(bytes)`** — `"11.0 MB"`
- **`formatNumber(n)`** — Locale-aware: `"1,234,567"`
- **`success(text)` / `error(text)`** — Green check / red X prefix
- **`heading(text)`** — Bold text
- **`summaryBlock({ title, rows, footer })`** — Key-value table with borders
- **`dataTable(headings, rows)`** — Multi-column data table

Tables use `cli-table3` with custom border characters. `visualLength()` strips ANSI escape codes for accurate column width calculations. Columns expand to fill terminal width.

## Title Parser (`parse-titles.ts`)

`parseTitles(input: string, maxTitle?: number): number[]`

Accepts: `"29"`, `"1,3,8,11"`, `"1-5"`, `"1-5,8,11"` (mixed ranges and lists).

Validates range 1–`maxTitle` (default 54 for USC, 50 for eCFR), rejects floats/letters, deduplicates, returns sorted ascending.

## Build Configuration

- **tsup**: ESM output with `#!/usr/bin/env node` shebang banner injected at build time
- **Binary**: `"lexbuild": "./dist/index.js"` in package.json `bin` field
- **Dependencies**: `commander`, `chalk`, `ora`, `cli-table3` for CLI; `@lexbuild/core`, `@lexbuild/usc`, and `@lexbuild/ecfr` via `workspace:*`

## Error Handling

All errors call `process.exit(1)`:

- **Validation errors**: Missing/conflicting options → `console.error()` + exit
- **File not found**: `existsSync()` check → error message + exit
- **Conversion/download failures**: `try-catch` → `spinner.fail()` + exit
- **Partial failures** (some downloads fail): Success summary + individual error messages

## Key Design Choices

- **No global middleware**: All logic is self-contained in command `.action()` handlers
- **Spinner text mutation**: Multi-title loops update spinner text in-place rather than creating new spinners
- **Dynamic table columns**: Summary tables adapt columns based on granularity (section shows chapters + sections, title shows only tokens)
- **Relative path reporting**: File paths in output use `relative(cwd, absolutePath)` for readability
- **Performance timing**: Uses `performance.now()` for high-resolution elapsed time
