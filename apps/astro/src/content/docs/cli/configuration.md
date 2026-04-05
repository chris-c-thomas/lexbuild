---
title: "Configuration"
description: "Configure the LexBuild CLI with flags for output directories, link styles, notes inclusion, and granularity."
order: 7
---

# Configuration

The LexBuild CLI is configured entirely through command-line flags. There is no configuration file and no environment variables. This keeps the tool stateless and reproducible -- the same command always produces the same output.

## Default Directories

| Purpose | Default Path | Override Flag |
|---|---|---|
| USC XML downloads | `./downloads/usc/xml/` | `download-usc -o <dir>` |
| eCFR XML downloads | `./downloads/ecfr/xml/` | `download-ecfr -o <dir>` |
| FR downloads | `./downloads/fr/` | `download-fr -o <dir>` |
| Converted output | `./output/` | `convert-usc -o <dir>` |

### Output Directory Behavior

The `-o` flag on convert commands specifies a base output directory. LexBuild automatically appends source-specific subdirectories:

```bash
lexbuild convert-usc --all -o /data/legal
# Writes to: /data/legal/usc/title-01/...

lexbuild convert-ecfr --all -o /data/legal
# Writes to: /data/legal/ecfr/title-01/...

lexbuild convert-fr --all -o /data/legal
# Writes to: /data/legal/fr/2026/01/...
```

This means you can point all three sources at the same base directory and they will not conflict.

## Link Styles

Cross-references between legal sections (e.g., "see section 101 of title 17") are rendered according to the `--link-style` flag.

| Style | Description | Example Output |
|---|---|---|
| `plaintext` (default) | No links, citation text only | `section 101 of title 17` |
| `relative` | Relative Markdown links within the corpus | `[section 101 of title 17](../../title-17/chapter-01/section-101.md)` |
| `canonical` | Absolute URLs to official sources | `[section 101 of title 17](https://uscode.house.gov/view.xhtml?req=...)` |

**When to use each style:**

- **`plaintext`** -- best for AI/RAG ingestion where links add noise. This is the default.
- **`relative`** -- best when you want navigable cross-references within the converted corpus. Links that cannot be resolved within the corpus fall back to official source URLs.
- **`canonical`** -- best when you want every reference to link to the authoritative online source.

```bash
lexbuild convert-usc --all --link-style relative
lexbuild convert-ecfr --all --link-style canonical
```

## Notes Inclusion

By default, all notes are included in the output: editorial notes, statutory notes, and amendment history. You can disable notes entirely or include specific categories.

### Disable All Notes

```bash
lexbuild convert-usc --all --no-include-notes
```

### Selective Inclusion

When you set any selective flag, the broad `--include-notes` is automatically turned off. Only the categories you specify are included.

```bash
# Editorial notes only (e.g., transfer notices, cross-references)
lexbuild convert-usc --all --include-editorial-notes

# Statutory notes only (e.g., effective date provisions, short titles)
lexbuild convert-usc --all --include-statutory-notes

# Amendment history only
lexbuild convert-usc --all --include-amendments

# Combine selective flags
lexbuild convert-usc --all --include-editorial-notes --include-amendments
```

These flags apply to both USC and eCFR conversion commands.

## Granularity

Granularity controls how much content is written to each output file. Available levels vary by source.

### U.S. Code

| Level | Output |
|---|---|
| `section` (default) | One `.md` per section, organized in chapter directories |
| `chapter` | One `.md` per chapter, all sections inlined |
| `title` | One `.md` per title, entire hierarchy inlined |

### eCFR

| Level | Output |
|---|---|
| `section` (default) | One `.md` per section, organized in part/chapter directories |
| `part` | One `.md` per part, all sections inlined |
| `chapter` | One `.md` per chapter, all parts and sections inlined |
| `title` | One `.md` per title, entire hierarchy inlined |

### Federal Register

FR documents are inherently atomic. There is no granularity option -- each document always produces a single `.md` file.

```bash
lexbuild convert-usc --all -g chapter
lexbuild convert-ecfr --all -g part
```

## Dry Run

Use `--dry-run` to parse XML and report statistics without writing any files. This is useful for previewing output size or verifying your options before a long conversion run.

```bash
lexbuild convert-usc --all --dry-run
lexbuild convert-ecfr --titles 17 --dry-run -g part
```

The dry run reports section counts, chapter/part counts, and estimated token counts for each title processed.

## Source Credits

Source credit annotations (statutory provenance text like "(July 30, 1947, ch. 388, 61 Stat. 633.)") are included by default. Disable them with:

```bash
lexbuild convert-usc --all --no-include-source-credits
```

## Verbose Output

Add `-v` or `--verbose` to see the path of every file written:

```bash
lexbuild convert-usc --titles 1 -v
```

## Quick Reference

| What | Flag | Default |
|---|---|---|
| Output directory | `-o, --output` | `./output` |
| Granularity | `-g, --granularity` | `section` |
| Link style | `--link-style` | `plaintext` |
| Include all notes | `--include-notes` | on |
| Disable all notes | `--no-include-notes` | -- |
| Editorial notes only | `--include-editorial-notes` | off |
| Statutory notes only | `--include-statutory-notes` | off |
| Amendments only | `--include-amendments` | off |
| Source credits | `--include-source-credits` | on |
| Dry run | `--dry-run` | off |
| Verbose | `-v, --verbose` | off |

For the full list of flags on every command, see the [CLI Reference](/docs/reference/cli-reference).
