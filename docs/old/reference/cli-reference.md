# CLI Reference

The `lexbuild` CLI is the primary interface for downloading U.S. Code XML from the OLRC and converting it to structured Markdown. It is distributed as the `@lexbuild/cli` npm package, which bundles `@lexbuild/core` and `@lexbuild/usc` as dependencies. All heavy lifting is delegated to those packages; the CLI is a thin orchestration layer providing argument parsing, progress display, and error reporting.

## Installation

```bash
# Run without installing (npx)
npx @lexbuild/cli <command> [options]

# Run without installing (pnpm dlx)
pnpm dlx @lexbuild/cli <command> [options]

# Global install (npm)
npm install -g @lexbuild/cli

# Global install (pnpm)
pnpm add -g @lexbuild/cli
```

**Requires:** Node.js >= 22

---

## Commands

### `lexbuild download [options]`

Fetch U.S. Code XML files from the Office of the Law Revision Counsel (OLRC). Downloads are ZIP archives containing a single XML file per title. The downloader extracts the XML and cleans up temporary files.

Exactly one of `--titles` or `--all` is required.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--titles <spec>` | string | -- | Title(s) to download. Accepts a single number (`1`), a range (`1-5`), or a comma-separated mix (`1-5,8,11`) |
| `--all` | flag | -- | Download all 54 titles. Uses a single bulk ZIP for efficiency |
| `-o, --output <dir>` | string | `./downloads/usc/xml` | Directory to write extracted XML files |
| `--release-point <id>` | string | `CURRENT_RELEASE_POINT` (currently `119-73not60`) | OLRC release point identifier. Format: `{congress}-{law}[not{excluded}]` |

#### Release Point Format

Release points identify which public laws are incorporated into the XML. The format is `{congress}-{law}`, optionally with exclusion suffixes. For example:

- `119-73` means "through Public Law 119-73"
- `119-73not60` means "through Public Law 119-73, excluding Public Law 119-60"

The default release point is bundled in `@lexbuild/usc` as the `CURRENT_RELEASE_POINT` constant. Use `--release-point` to override it when a newer release is available from OLRC.

#### Download URLs

Individual title: `https://uscode.house.gov/download/releasepoints/us/pl/{congress}/{law}/xml_usc{NN}@{release-point}.zip`

All titles (bulk): `https://uscode.house.gov/download/releasepoints/us/pl/{congress}/{law}/xml_uscAll@{release-point}.zip`

---

### `lexbuild convert [options] [input]`

Convert U.S. Code XML to structured Markdown with YAML frontmatter and JSON metadata indexes.

#### Input Modes

Exactly one input mode is required:

| Mode | Syntax | Description |
|------|--------|-------------|
| File path | `lexbuild convert ./path/to/usc01.xml` | Convert a single XML file |
| Title spec | `lexbuild convert --titles 1-5,8` | Convert by title number(s); resolves files in `--input-dir` |
| All titles | `lexbuild convert --all` | Convert all XML files found in `--input-dir` |

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `[input]` | positional | -- | Path to a single USC XML file |
| `--titles <spec>` | string | -- | Title(s) to convert: `1`, `1-5`, or `1-5,8,11` |
| `--all` | flag | -- | Convert all downloaded titles found in `--input-dir` |
| `-o, --output <dir>` | string | `./output` | Root output directory |
| `-i, --input-dir <dir>` | string | `./downloads/usc/xml` | Directory containing XML files (used with `--titles` and `--all`) |
| `-g, --granularity <level>` | string | `section` | Output granularity: `section`, `chapter`, or `title` |
| `--link-style <style>` | string | `plaintext` | Cross-reference link style: `plaintext`, `relative`, or `canonical` |
| `--no-include-source-credits` | flag | -- | Exclude source credit annotations from output |
| `--no-include-notes` | flag | -- | Exclude all notes from output |
| `--include-editorial-notes` | flag | -- | Include editorial notes |
| `--include-statutory-notes` | flag | -- | Include statutory notes |
| `--include-amendments` | flag | -- | Include amendment history notes |
| `--dry-run` | flag | -- | Parse and report statistics without writing any files |
| `-v, --verbose` | flag | -- | Enable verbose logging output |

---

## Granularity Modes

The `--granularity` option controls how many sections are combined per output file and what directory structure is produced.

| Mode | Output Pattern | Description | Sidecar Files |
|------|---------------|-------------|---------------|
| `section` | `title-NN/chapter-NN/section-N.md` | One file per section (default). Optimal for RAG chunking. | `_meta.json` + `README.md` per directory |
| `chapter` | `title-NN/chapter-NN/chapter-NN.md` | One file per chapter with all sections inlined. | `_meta.json` + `README.md` per title directory |
| `title` | `title-NN.md` | One file per title with the entire hierarchy inlined. Enriched frontmatter. No sidecar files. | None |

See [Output Format](output-format.md) for the complete specification of each mode's directory layout, frontmatter schema, and `_meta.json` structure.

---

## Notes Filtering

By default, LexBuild includes the core statutory text, source credits, and notes. You can disable notes entirely or selectively include subsets via CLI flags.

### Default Behavior

- Source credits: **included** (disable with `--no-include-source-credits`)
- All notes: **included** (disable with `--no-include-notes`)

### Inclusion Flags

The `--include-*` flags are **additive** -- when multiple flags are specified, their note sets are combined. When you disable all notes with `--no-include-notes`, these flags let you selectively re-enable specific categories:

| Flag | Notes Included |
|------|---------------|
| `--include-editorial-notes` | Editorial notes (amendments, codification, etc. under the "Editorial Notes" cross-heading) |
| `--include-statutory-notes` | Statutory notes (change of name, effective dates, etc. under the "Statutory Notes" cross-heading) |
| `--include-amendments` | Amendment history notes specifically (`topic="amendments"`), regardless of category |

#### Combination Examples

```bash
# Include only amendments
lexbuild convert --titles 1 --include-amendments

# Include all editorial notes (which includes amendments)
lexbuild convert --titles 1 --include-editorial-notes

# Include both editorial and statutory notes
lexbuild convert --titles 1 --include-editorial-notes --include-statutory-notes
```

### Exclusion

```bash
# Exclude all notes (even if include flags are also specified)
lexbuild convert --titles 1 --no-include-notes
```

The `--no-include-notes` flag takes precedence over all `--include-*` flags.

---

## Link Styles

The `--link-style` option controls how cross-references (`<ref>` elements in the source XML) are rendered in the Markdown output.

| Style | Description | Example Output |
|-------|-------------|---------------|
| `plaintext` | No links; reference text only (default) | `section 101 of title 5` |
| `relative` | Relative Markdown links within the corpus; OLRC URLs for external references | `[section 101 of title 5](../../title-05/chapter-01/section-101.md)` |
| `canonical` | OLRC website URLs for all USC references | `[section 101 of title 5](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title5-section101)` |

References to Statutes at Large (`/us/stat/...`), Public Laws (`/us/pl/...`), and session laws (`/us/act/...`) always render as plain text regardless of link style.

---

## Examples

### Quick Start

```bash
# Download and convert all 54 titles with default settings
lexbuild download --all
lexbuild convert --all

# Start small -- one title
lexbuild download --titles 1
lexbuild convert --titles 1
```

### Download Examples

```bash
# Single title
lexbuild download --titles 1

# Range of titles
lexbuild download --titles 1-5

# Mixed specification
lexbuild download --titles 1-5,8,11,26

# All titles (single bulk ZIP, faster than individual downloads)
lexbuild download --all

# Custom output directory
lexbuild download --titles 1 -o ./my-xml-files

# Specific release point
lexbuild download --titles 26 --release-point 119-73not60
```

### Convert Examples

```bash
# Convert a single XML file directly
lexbuild convert ./downloads/usc/xml/usc01.xml -o ./output

# Convert by title number
lexbuild convert --titles 1

# Convert multiple titles
lexbuild convert --titles 1-5,8,11

# Custom input and output directories
lexbuild convert --titles 1-5 -i ./my-xml-files -o ./my-output

# Chapter-level granularity
lexbuild convert --titles 1 -g chapter -o ./output

# Title-level granularity
lexbuild convert --titles 1 -g title -o ./output

# Relative cross-reference links
lexbuild convert --titles 1-5 --link-style relative

# Canonical (OLRC website) links
lexbuild convert --titles 5 --link-style canonical

# Include all notes
lexbuild convert --titles 1 --include-editorial-notes --include-statutory-notes

# Include only amendment history
lexbuild convert --titles 1 --include-amendments

# Exclude source credits
lexbuild convert --titles 1 --no-include-source-credits

# Exclude all notes explicitly
lexbuild convert --titles 1 --no-include-notes

# Dry run -- see stats without writing files
lexbuild convert --titles 42 --dry-run

# Verbose logging
lexbuild convert --titles 1 -v
```

### Combined Workflows

```bash
# Download a range and convert with editorial notes
lexbuild download --titles 1-5
lexbuild convert --titles 1-5 --include-editorial-notes -o ./output

# Full corpus with all notes, relative links, chapter granularity
lexbuild download --all
lexbuild convert --all -g chapter --link-style relative \
  --include-editorial-notes --include-statutory-notes -o ./full-output

# Title-level output for feeding entire titles into LLM context
lexbuild download --titles 1
lexbuild convert --titles 1 -g title -o ./llm-input
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (invalid arguments, missing files, conversion failure) |

Errors are printed to stderr. When `--verbose` is enabled, additional diagnostic information is included.
