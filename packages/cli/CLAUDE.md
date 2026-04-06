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
    ├── list-release-points.ts  # lexbuild list-release-points command
    ├── download-ecfr.ts        # lexbuild download-ecfr command
    ├── convert-ecfr.ts         # lexbuild convert-ecfr command
    ├── download-fr.ts          # lexbuild download-fr command
    ├── convert-fr.ts           # lexbuild convert-fr command
    ├── enrich-fr.ts           # lexbuild enrich-fr command
    ├── ingest.ts              # lexbuild ingest command (SQLite population)
    └── api-key.ts             # lexbuild api-key create|list|revoke|update
```

## Commands

All commands support `--help` for full option details.

| Command | Purpose | Key Options |
|---------|---------|-------------|
| `download-usc` | Download USC XML from OLRC | `--all`, `--titles <spec>`, `--release-point <id>` |
| `convert-usc` | Convert USC XML to Markdown | `[input]`, `--all`, `--titles`, `-g section\|chapter\|title` |
| `download-ecfr` | Download eCFR XML | `--all`, `--titles`, `--source ecfr-api\|govinfo`, `--date` |
| `convert-ecfr` | Convert eCFR XML to Markdown | `[input]`, `--all`, `--titles`, `-g section\|part\|chapter\|title`, `--currency-date` |
| `download-fr` | Download FR documents (XML+JSON) | `--from`/`--to`, `--recent <days>`, `--document <number>` |
| `convert-fr` | Convert FR XML to Markdown | `[input]`, `--all`, `--from`/`--to`, `--types` |
| `enrich-fr` | Enrich FR .md frontmatter with API metadata | `--from`/`--to`, `--recent <days>`, `--force` |
| `ingest` | Populate SQLite DB from converted .md files | `[content-dir]`, `--db`, `--source`, `--incremental`, `--prune`, `--batch-size`, `--stats` |
| `list-release-points` | List OLRC release points | `-n <count>` |
| `api-key create` | Create a new API key | `--label`, `--tier`, `--rate-limit`, `--expires`, `--db` |
| `api-key list` | List all API keys | `--db`, `--include-revoked` |
| `api-key revoke` | Revoke an API key | `--prefix`, `--db` |
| `api-key update` | Update key tier/limit | `--prefix`, `--tier`, `--rate-limit`, `--db` |

**Common convert options**: `--output <dir>` (default `./output`), `--link-style relative|canonical|plaintext`, `--include-notes`, `--include-editorial-notes`, `--include-statutory-notes`, `--include-amendments`, `--dry-run`, `-v`.

**Key behaviors**:
- Download commands require `--titles`/`--all` (USC/eCFR) or `--from`/`--recent`/`--document` (FR).
- Convert commands have three input modes (mutually exclusive): positional `[input]`, `--titles`, or `--all`.
- If any selective note flag is set, the broad `--include-notes` is automatically disabled.
- FR has no `--granularity` (documents are already atomic) and no `--titles` (date-based).
- `enrich-fr` patches YAML frontmatter only (no XML re-parse or Markdown re-render). Skips files that already have `fr_citation` unless `--force`. Only needed for govinfo bulk downloads; the default `fr-api` source downloads JSON sidecars that the converter uses automatically.
- Bare `download`/`convert` without a source suffix prints an error listing available commands.

### Convert Summary Footer

The multi-title conversion summary footer shows only the primary converted unit (e.g., `Converted 60,215 sections in 21.1s`). Do NOT include the title count in the footer — the per-title table already shows that.

## UI Module (`ui.ts`)

Terminal output utilities: `createSpinner()`, `formatDuration()`, `formatBytes()`, `formatNumber()`, `success()`/`error()`, `summaryBlock()`, `dataTable()`. Tables use `cli-table3` with custom borders. `visualLength()` strips ANSI escape codes for column width.

## Title Parser (`parse-titles.ts`)

`parseTitles(input: string, maxTitle?: number): number[]` — parses `"1-5,8,11"` (ranges + lists), validates range 1–`maxTitle` (54 USC, 50 eCFR), dedupes, sorts ascending.

## Build Configuration

- **tsup**: ESM output with `#!/usr/bin/env node` shebang banner injected at build time
- **Binary**: `"lexbuild": "./dist/index.js"` in package.json `bin` field
- **Dependencies**: `commander`, `chalk`, `ora`, `cli-table3` for CLI; `@lexbuild/core`, `@lexbuild/usc`, `@lexbuild/ecfr`, and `@lexbuild/fr` via `workspace:*`

## Error Handling

All errors call `process.exit(1)`:

- **Validation errors**: Missing/conflicting options → `console.error()` + exit
- **File not found**: `existsSync()` check → error message + exit
- **Conversion/download failures**: `try-catch` → `spinner.fail()` + exit
- **Partial failures** (some downloads fail): Success summary + individual error messages

## Key Design Choices

- **No global middleware**: All logic is self-contained in command `.action()` handlers
- **Spinner text mutation**: Multi-title loops update spinner text in-place rather than creating new spinners
- **Download progress via callbacks**: Downloader packages (`@lexbuild/usc`, `@lexbuild/ecfr`) expose `onProgress` callbacks on their options interfaces. The CLI commands pass callbacks that update `spinner.text` with per-title progress (e.g., `"Downloading eCFR titles from eCFR API (3/49) — Title 3"`). Progress totals exclude reserved titles. USC bulk zip uses `phase: "downloading" | "extracting"` to distinguish archive download from per-title extraction.
- **Dynamic table columns**: Summary tables adapt columns based on granularity (section shows chapters + sections, title shows only tokens)
- **Relative path reporting**: File paths in output use `relative(cwd, absolutePath)` for readability
- **Performance timing**: Uses `performance.now()` for high-resolution elapsed time
