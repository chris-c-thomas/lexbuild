# @lexbuild/cli

`@lexbuild/cli` is the published npm package that end users install to download and convert legislative XML. It provides the `lexbuild` binary with `download` and `convert` commands. The CLI is a thin orchestration layer: all conversion and download logic lives in `@lexbuild/usc`, and all parsing and rendering infrastructure lives in `@lexbuild/core`. The CLI's responsibilities are command-line argument parsing, terminal UI (spinners, tables, formatted output), input validation, multi-title orchestration, and error reporting.

## Module Map

```
packages/cli/src/
  index.ts              # Entry point: Commander program setup, registers commands (~33 lines)
  ui.ts                 # Terminal UI utilities: spinners, tables, formatters (~178 lines)
  parse-titles.ts       # Title specification parser: "1-5,8,11" -> number[] (~69 lines)
  commands/
    download.ts         # lexbuild download command (~126 lines)
    convert.ts          # lexbuild convert command (~407 lines)
```

The entire CLI is approximately 800 lines of TypeScript. The command files are the largest modules, and even they are primarily wiring between `@lexbuild/usc`'s API and the UI module's output functions.

---

## Command Architecture

### Entry Point

**File**: `packages/cli/src/index.ts`

The entry point creates a `commander` `Command` instance, sets the program name, description, and version (read from `package.json` at runtime), then registers the two subcommands:

```typescript
const program = new Command();

program
  .name("lexbuild")
  .description("Convert U.S. legislative XML (USLM) to structured Markdown for AI/RAG ingestion")
  .version(pkg.version);

program.addCommand(convertCommand);
program.addCommand(downloadCommand);

program.parse();
```

### Adding New Source Commands

When a new source package is added (e.g., `@lexbuild/cfr`), the expected pattern is:

1. Create `src/commands/download-cfr.ts` and `src/commands/convert-cfr.ts` in the CLI package.
2. Import the new source package's API (e.g., `convertCfrTitle()` from `@lexbuild/cfr`).
3. Register the commands: `program.addCommand(convertCfrCommand)`.
4. Reuse the existing UI module for spinners, tables, and formatting.

The CLI contains no conversion logic itself, so adding new sources requires no changes to existing command files.

---

## Download Command

**File**: `packages/cli/src/commands/download.ts`

### Options

| Option | Default | Description |
|---|---|---|
| `-o, --output <dir>` | `./downloads/usc/xml` | Download directory |
| `--titles <spec>` | -- | Title(s) to download: `1`, `1-5`, `1-5,8,11` |
| `--all` | `false` | Download all 54 titles (single bulk ZIP) |
| `--release-point <id>` | `CURRENT_RELEASE_POINT` | OLRC release point identifier |

Requires either `--titles` or `--all`. If neither is provided, the command exits with an error message.

### Behavior

1. Validates options and parses the title specification via `parseTitles()`.
2. Starts an `ora` spinner with a label like `"Downloading 5 titles..."`.
3. Calls `downloadTitles()` from `@lexbuild/usc` with the resolved options.
4. On success, stops the spinner and renders:
   - A summary block with release point and output directory.
   - A data table listing each downloaded title with its file size and path.
   - Error messages for any individual title failures.
   - A footer with total download count, size, and duration.
5. On failure, calls `spinner.fail()` with the error message and exits with code 1.

### Progress Reporting

The download command uses a single spinner for the entire operation. Multi-title downloads show a static spinner label (the command delegates to `@lexbuild/usc`'s `downloadTitles()`, which handles the bulk-vs-individual logic internally). After completion, the data table provides per-title details.

---

## Convert Command

**File**: `packages/cli/src/commands/convert.ts`

### Options

| Option | Default | Description |
|---|---|---|
| `[input]` (positional) | -- | Path to a single USC XML file |
| `-o, --output <dir>` | `./output` | Output directory |
| `--titles <spec>` | -- | Title(s) to convert |
| `--all` | `false` | Convert all titles found in `--input-dir` |
| `-i, --input-dir <dir>` | `./downloads/usc/xml` | Directory containing USC XML files |
| `-g, --granularity <level>` | `section` | `section`, `chapter`, or `title` |
| `--link-style <style>` | `plaintext` | `plaintext`, `canonical`, or `relative` |
| `--include-source-credits` | `true` | Include source credits |
| `--no-include-source-credits` | -- | Exclude source credits |
| `--include-notes` | `true` | Include all notes |
| `--no-include-notes` | -- | Exclude all notes |
| `--include-editorial-notes` | `false` | Include editorial notes only |
| `--include-statutory-notes` | `false` | Include statutory notes only |
| `--include-amendments` | `false` | Include amendment notes only |
| `--dry-run` | `false` | Parse and report without writing files |
| `-v, --verbose` | `false` | Print detailed file output |

### Three Input Modes

The convert command supports three mutually exclusive input modes:

1. **Positional `<input>`** -- convert a single XML file. The path is resolved, and `resolveUscXmlPath()` also checks for a zero-padded variant (e.g., `usc1.xml` resolves to `usc01.xml` if it exists).
2. **`--titles <spec>`** -- convert specific titles by number. Each title's XML file is located at `{inputDir}/usc{NN}.xml`.
3. **`--all`** -- scan `--input-dir` for all USC XML files (matching `/^usc(\d{2})\.xml$/`) and convert them. The `discoverTitles()` helper reads the directory and returns sorted title numbers.

Specifying more than one mode, or none, produces a validation error.

### Note Flag Logic

If any selective note flag is set (`--include-editorial-notes`, `--include-statutory-notes`, or `--include-amendments`), the blanket `--include-notes` flag is automatically set to `false` via `buildConvertOptions()`. This prevents the broad flag from overriding selective inclusion:

```typescript
const hasSelectiveFlags =
  options.includeEditorialNotes || options.includeStatutoryNotes || options.includeAmendments;
const includeNotes = hasSelectiveFlags ? false : options.includeNotes;
```

### Multi-Title Orchestration

For `--titles` and `--all` modes, the command loops over each title sequentially:

1. Starts a single spinner.
2. For each title, updates the spinner text in-place: `"Converting Title 26 (5/54)..."`.
3. Calls `convertTitle()` from `@lexbuild/usc` and collects the result.
4. On any failure, stops the spinner, prints the error, and exits.

After all titles complete, the command renders:

- A summary header block with the output directory.
- A data table with per-title results. Columns adapt to granularity:
  - **Section**: Title, Name, Chapters, Sections, Tokens, Duration
  - **Chapter**: Title, Name, Chapters, Tokens, Duration
  - **Title**: Title, Name, Tokens, Duration
- A totals row at the bottom of the table.
- A footer with the total count and duration.

### Single-File Mode

When a positional `<input>` is provided, `convertSingleFile()` renders a compact summary block instead of a data table. It includes sections written, chapters, estimated tokens, files written (if not dry-run), peak memory, duration, and output directory.

---

## Title Parser

**File**: `packages/cli/src/parse-titles.ts`

### parseTitles()

```typescript
function parseTitles(input: string): number[];
```

Parses a title specification string into a sorted, deduplicated array of title numbers.

**Supported formats**:
- Single number: `"29"` produces `[29]`
- Comma-separated list: `"1,3,8,11"` produces `[1, 3, 8, 11]`
- Range: `"1-5"` produces `[1, 2, 3, 4, 5]`
- Mixed: `"1-5,8,11"` produces `[1, 2, 3, 4, 5, 8, 11]`

**Validation**:
- Empty strings throw an error.
- Non-integer values (floats, letters) throw an error.
- Numbers outside the range 1-54 throw an error.
- Inverted ranges (start > end) throw an error.
- Results are deduplicated via `Set` and returned in ascending order.

---

## UI Module

**File**: `packages/cli/src/ui.ts`

The UI module provides consistent terminal output formatting using `chalk`, `ora`, and `cli-table3`.

### Functions

| Function | Signature | Output |
|---|---|---|
| `createSpinner(text)` | `(text: string) => Ora` | Ora spinner with "dots" animation |
| `formatDuration(ms)` | `(ms: number) => string` | `"1.50s"`, `"2.3s"`, or `"1m 23s"` |
| `formatBytes(bytes)` | `(bytes: number) => string` | `"11.0 MB"`, `"1.2 KB"`, `"256 B"` |
| `formatNumber(n)` | `(n: number) => string` | Locale-aware: `"1,234,567"` |
| `heading(text)` | `(text: string) => string` | Bold text |
| `success(text)` | `(text: string) => string` | Green checkmark prefix: `"checkmark text"` |
| `error(text)` | `(text: string) => string` | Red X prefix: `"X text"` |
| `summaryBlock(options)` | `(options: SummaryBlockOptions) => string` | Key-value table with title and optional footer |
| `dataTable(head, rows)` | `(head: string[], rows: string[][]) => string` | Multi-column data table |

### SummaryBlockOptions

```typescript
interface SummaryBlockOptions {
  title: string;
  rows: Array<[label: string, value: string]>;
  footer?: string;
}
```

### Table Styling

Tables use `cli-table3` with custom border characters that produce a clean, indented layout:

- 2-character left indent (`"  "`)
- 2-character column gap (`"  "`)
- No right border
- Single-line horizontal rules using `"--"` characters
- Dim-colored labels, normal-weight values

The `visualLength()` helper strips ANSI escape codes for accurate column width calculations. The `fillWidths()` function computes column widths that expand a flexible column (typically the "Name" column) to fill the terminal width.

---

## Build Configuration

### tsup

The CLI is built with tsup, configured to produce a single ESM output file with a shebang banner:

- **Format**: ESM only
- **Banner**: `#!/usr/bin/env node` injected at the top of the output
- **External**: `commander` is marked as an external dependency (not bundled)
- **Binary**: the `package.json` `bin` field maps `"lexbuild"` to `"./dist/index.js"`

### Dependencies

| Dependency | Purpose |
|---|---|
| `commander` | Command-line argument parsing |
| `chalk` | Terminal colors |
| `ora` | Spinner animations |
| `cli-table3` | Formatted table output |
| `@lexbuild/core` | Shared types (via `workspace:*`) |
| `@lexbuild/usc` | Conversion and download API (via `workspace:*`) |

---

## Error Handling

The CLI follows a consistent error handling pattern:

### Validation Errors

Missing or conflicting options produce a descriptive error message via `console.error()` with the `error()` formatter, then exit with code 1. No stack traces are shown to users.

Examples:
- `"Specify an input file, --titles <spec>, or --all"`
- `"Cannot combine <input>, --titles, and --all -- use only one"`
- `"Title number 55 out of range (must be 1-54)"`

### File Not Found

Before calling conversion, the CLI checks for file existence with `existsSync()`. Missing files produce a clear message with the path and exit with code 1.

### Conversion/Download Failures

Runtime errors from `@lexbuild/usc` are caught in try-catch blocks. The spinner is stopped with `spinner.fail(message)`, and the process exits with code 1.

### Partial Failures (Downloads)

The download result may contain both `files` (successes) and `errors` (failures). The CLI renders the success table first, then lists individual errors. The footer indicates the failure count.

### Performance Timing

All timing uses `performance.now()` for high-resolution measurement. Duration values are formatted by `formatDuration()` and included in both summary blocks and data tables.

---

## Path Handling

File paths in CLI output use `path.relative(process.cwd(), absolutePath)` for readability. Users see `output/usc/title-01/chapter-01/section-1.md` rather than the full absolute path. If the relative path would be empty (same directory), the absolute path is used as fallback.

See [CLI Reference](../reference/cli-reference.md) for the complete user-facing command documentation, and [Extending LexBuild](../development/extending.md) for how to add new source commands.
