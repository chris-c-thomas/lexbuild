# @lexbuild/cli

Published npm package providing the `lexbuild` binary. The CLI is a thin orchestration layer -- all conversion and download logic lives in source packages (`@lexbuild/usc`, `@lexbuild/ecfr`), and all parsing and rendering lives in `@lexbuild/core`. The CLI handles command-line parsing, terminal UI, input validation, multi-title orchestration, and error reporting.

## Module Map

```
packages/cli/src/
  index.ts                    # Entry point: Commander setup, registers commands
  ui.ts                       # Terminal UI: spinners, tables, formatters
  parse-titles.ts             # Title specification parser
  commands/
    download-usc.ts           # lexbuild download-usc command
    convert-usc.ts            # lexbuild convert-usc command
    download-ecfr.ts          # lexbuild download-ecfr command
    convert-ecfr.ts           # lexbuild convert-ecfr command
```

## Command Architecture

The entry point creates a [Commander](https://github.com/tj/commander.js) program, sets the name, description, and version (read from `package.json`), and registers four source-specific commands plus bare `download` and `convert` stubs. Running `lexbuild download` or `lexbuild convert` without a source suffix prints an error listing the available source-specific commands and exits with code 1.

Commands follow the `{action}-{source}` naming pattern: `download-usc`, `convert-usc`, `download-ecfr`, `convert-ecfr`. Each command is defined in its own module under `commands/` and registered via `program.addCommand()`.

## Commands

### `lexbuild download-usc`

Downloads USC XML from OLRC. Delegates to `downloadTitles()` from `@lexbuild/usc`. Auto-detects the latest OLRC release point by scraping the download page; falls back to `FALLBACK_RELEASE_POINT` if detection fails.

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./downloads/usc/xml` | Download directory |
| `--titles <spec>` | -- | Title(s) to download: `"1"`, `"1-5"`, `"1-5,8,11"` |
| `--all` | `false` | Download all 54 titles (single bulk ZIP) |
| `--release-point <id>` | Auto-detected | Pin a specific OLRC release point |

Requires either `--titles` or `--all`. The summary output shows `(auto-detected)` when the release point was detected at runtime.

### `lexbuild convert-usc`

Converts USC XML to Markdown. Delegates to `convertTitle()` from `@lexbuild/usc`.

| Option | Default | Description |
|--------|---------|-------------|
| `[input]` (positional) | -- | Path to a single USC XML file |
| `-o, --output <dir>` | `./output` | Output directory |
| `--titles <spec>` | -- | Title(s) to convert |
| `--all` | `false` | Convert all titles found in `--input-dir` |
| `-i, --input-dir <dir>` | `./downloads/usc/xml` | Directory containing USC XML files |
| `-g, --granularity` | `section` | Output granularity: `section`, `chapter`, or `title` |
| `--link-style` | `plaintext` | Cross-reference style: `plaintext`, `relative`, or `canonical` |
| `--include-source-credits` | `true` | Include source credits in output |
| `--include-notes` | `true` | Include all notes (editorial, statutory, amendments) |
| `--include-editorial-notes` | `false` | Include editorial notes only |
| `--include-statutory-notes` | `false` | Include statutory notes only |
| `--include-amendments` | `false` | Include amendment notes only |
| `--dry-run` | `false` | Parse only, no files written |
| `-v, --verbose` | `false` | Print detailed file output |

**Three input modes** (mutually exclusive): the `[input]` positional argument for a single file, `--titles` for specific titles by number, or `--all` to discover and convert every XML file in `--input-dir`.

**Note flag logic.** If any selective note flag is set (`--include-editorial-notes`, `--include-statutory-notes`, or `--include-amendments`), the broad `--include-notes` flag is automatically disabled to prevent conflicts.

**Output directory.** The `-o` flag appends a source subdirectory: `convert-usc -o /path` writes to `/path/usc/...`, not `/path/...` directly.

### `lexbuild download-ecfr`

Downloads eCFR XML. Defaults to the ecfr.gov API (daily-updated); govinfo bulk data is available as a fallback via `--source govinfo`. Delegates to `downloadEcfrTitlesFromApi()` or `downloadEcfrTitles()` from `@lexbuild/ecfr`.

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <dir>` | `./downloads/ecfr/xml` | Download directory |
| `--titles <spec>` | -- | Title(s) to download |
| `--all` | `false` | Download all 50 titles |
| `--source` | `ecfr-api` | Download source: `ecfr-api` (daily-updated) or `govinfo` (bulk) |
| `--date <YYYY-MM-DD>` | Today's currency date | Point-in-time date (`ecfr-api` source only) |

When using the `ecfr-api` source, the currency date is auto-detected from `/api/versioner/v1/titles` unless `--date` is specified. Output files use the same naming convention (`ECFR-title{N}.xml`) regardless of source.

### `lexbuild convert-ecfr`

Converts eCFR XML to Markdown. Delegates to `convertEcfrTitle()` from `@lexbuild/ecfr`. Accepts the same options as `convert-usc` with two eCFR-specific differences:

- `--input-dir` defaults to `./downloads/ecfr/xml`
- `--granularity` accepts `section`, `part`, `chapter`, or `title` (note: `part` is eCFR-specific; USC uses `chapter` instead)

All other options and behaviors -- note flags, link style, dry run, verbose output -- are identical to `convert-usc`.

## Title Parser

```typescript
parseTitles(input: string, maxTitle?: number): number[]
```

Parses a title specification string into a sorted, deduplicated array of title numbers. Supports single numbers (`"29"`), comma-separated lists (`"1,3,8,11"`), ranges (`"1-5"`), and mixed formats (`"1-5,8,11"`).

Validates that all numbers are positive integers within the range `1` to `maxTitle` (54 for USC, 50 for eCFR). Rejects floats, non-numeric characters, empty segments, and inverted ranges.

## UI Module

The UI module (`ui.ts`) provides consistent terminal output using [chalk](https://github.com/chalk/chalk), [ora](https://github.com/sindresorhus/ora), and [cli-table3](https://github.com/cli-table/cli-table3).

### Formatting Functions

| Function | Output | Example |
|----------|--------|---------|
| `createSpinner(text)` | Ora spinner with dots animation | `Converting Title 1...` |
| `formatDuration(ms)` | Human-readable duration | `"1.50s"`, `"1m 23s"` |
| `formatBytes(bytes)` | Human-readable file size | `"11.0 MB"` |
| `formatNumber(n)` | Locale-aware number | `"1,234,567"` |
| `success(text)` | Green checkmark prefix | |
| `error(text)` | Red X prefix | |
| `heading(text)` | Bold text | |

### Table Functions

| Function | Purpose |
|----------|---------|
| `summaryBlock({ title, rows, footer })` | Key-value table with horizontal rules, used for conversion summaries |
| `dataTable(headings, rows)` | Multi-column data table, used for per-title results |

Tables use custom border characters with 2-character left indent and 2-character column gaps. The `visualLength()` utility strips ANSI escape codes for accurate column width calculations. Columns expand to fill terminal width using the `fillWidths()` function, which designates one column as flexible to absorb remaining space.

## Multi-Title Orchestration

When processing multiple titles (via `--titles` or `--all`), the CLI loops sequentially through each title, updating the spinner text in-place rather than creating new spinners. After all titles complete, it renders a summary table and footer.

The summary table columns adapt to the active granularity:

- **Section granularity:** Title, Chapters, Sections, Tokens, Size, Time
- **Chapter/part granularity:** Title, Chapters/Parts, Tokens, Size, Time
- **Title granularity:** Title, Tokens, Size, Time

The footer reports the total count of the primary converted unit:

```
Converted 60,215 sections in 21.1s
Converted 2,880 chapters in 10.1s
Converted 8,305 parts in 14.2s
Converted 53 titles in 10.4s
```

## Build Configuration

The CLI is built with [tsup](https://github.com/egoist/tsup) targeting ESM output. The `#!/usr/bin/env node` shebang is injected as a banner at build time. The `bin` field in `package.json` maps `"lexbuild"` to `"./dist/index.js"`.

**Dependencies:**

- CLI framework: `commander`
- Terminal output: `chalk`, `ora`, `cli-table3`
- Source packages: `@lexbuild/core`, `@lexbuild/usc`, `@lexbuild/ecfr` (via `workspace:*`)

## Error Handling

All errors terminate with `process.exit(1)`:

| Error Type | Handling |
|------------|----------|
| Validation errors | Descriptive message via `console.error()`, exit |
| Missing/conflicting options | Error message listing valid combinations, exit |
| File not found | `existsSync()` check, clear message with file path, exit |
| Conversion/download failures | `try-catch` wrapping the source package call, `spinner.fail()`, exit |
| Partial download failures | Successful downloads shown in summary table, individual errors reported separately |

No global error middleware. All logic is self-contained in each command's `.action()` handler.
