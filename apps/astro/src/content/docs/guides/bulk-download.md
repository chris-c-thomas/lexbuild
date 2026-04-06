---
title: "Bulk Download"
description: "Download and manage the full corpus of U.S. Code, eCFR, and Federal Register content, including disk requirements, incremental updates, and granularity options."
order: 3
---

# Bulk Download

This guide walks you through downloading and converting the full corpus of U.S. legal content. You can process all three sources or pick the ones you need.

## Prerequisites

- Node.js 22 or later
- `@lexbuild/cli` installed globally or available via `npx`
- Sufficient disk space (see requirements below)

```bash
npm install -g @lexbuild/cli
```

## Disk Requirements

| Source | XML Download | Converted Markdown (section) | Converted Markdown (title) |
|---|---|---|---|
| U.S. Code | ~2 GB | ~1.5 GB (~60k files) | ~500 MB (54 files) |
| eCFR | ~1.5 GB | ~2 GB (~200k files) | ~800 MB (50 files) |
| Federal Register | Varies by date range | Varies | N/A (one file per document) |

XML downloads are stored in `./downloads/` and can be deleted after conversion. Converted Markdown goes to `./output/` by default.

## Full Corpus Download

### U.S. Code

Download all 54 titles from the OLRC, then convert to Markdown:

```bash
lexbuild download-usc --all
lexbuild convert-usc --all
```

Download takes 2-5 minutes depending on your connection. Conversion takes roughly 2 minutes for all 54 titles.

### eCFR

Download all 50 titles from the eCFR API, then convert:

```bash
lexbuild download-ecfr --all
lexbuild convert-ecfr --all
```

Download takes 3-8 minutes. Conversion takes roughly 3 minutes for all 50 titles.

### Federal Register

FR downloads are date-range based. To get the full historical archive from 2000 onward:

```bash
lexbuild download-fr --from 2000-01-01
lexbuild convert-fr --all
```

This downloads both XML and JSON metadata for every FR document since 2000 using the default `fr-api` source. The converter automatically uses the JSON sidecar to populate rich frontmatter fields (agencies, CFR references, docket IDs, citations, etc.), so no separate enrichment step is needed.

> [!NOTE]
> The `enrich-fr` command is only needed when using `--source govinfo` for historical backfill. The govinfo source provides XML only without JSON metadata. See [Federal Register CLI docs](/docs/cli/sources/federal-register) for details.

### Everything at Once

```bash
# Download all sources
lexbuild download-usc --all
lexbuild download-ecfr --all
lexbuild download-fr --from 2000-01-01

# Convert all sources
lexbuild convert-usc --all
lexbuild convert-ecfr --all
lexbuild convert-fr --all
```

## Single Title Processing

You do not need to download the entire corpus. Process individual titles:

```bash
# Download and convert USC Title 17 (Copyrights)
lexbuild download-usc --title 17
lexbuild convert-usc --title 17

# Download and convert eCFR Title 40 (Environmental Protection)
lexbuild download-ecfr --title 40
lexbuild convert-ecfr --title 40
```

## Preview with Dry Run

Before running a large conversion, use `--dry-run` to preview the file count without writing anything:

```bash
lexbuild convert-usc --all --dry-run
```

This scans the XML and reports how many files would be generated, without writing to disk.

## Incremental Updates

You do not need to re-download and re-convert the entire corpus to stay current.

### USC Release Points

The OLRC publishes new release points after each session of Congress. Check what is available:

```bash
lexbuild list-release-points
```

Then download and convert only the titles that changed.

### eCFR Point-in-Time

eCFR is updated daily. Use `--date` to download a specific point-in-time snapshot:

```bash
lexbuild download-ecfr --all --date 2026-04-01
lexbuild convert-ecfr --all
```

Without `--date`, you get the most current version.

### FR Rolling Updates

Use `--recent` to download only the most recent documents:

```bash
# Download FR documents from the last 30 days (XML + JSON from FR API)
lexbuild download-fr --recent 30

# Convert only the new date range (not --all, which reconverts everything)
lexbuild convert-fr --from 2026-03-01
```

### Update Scripts

For streamlined incremental updates, wrapper scripts handle the full pipeline (detect changes, download, convert, generate artifacts, deploy):

```bash
# All sources — auto-detects changes, downloads, converts, deploys
./scripts/update.sh

# Individual sources
./scripts/update-ecfr.sh               # Only changed titles (via API metadata)
./scripts/update-fr.sh --days 3         # Last 3 days
./scripts/update-usc.sh                 # Checks OLRC release point

# Local only (no VPS deploy)
./scripts/update.sh --skip-deploy
```

The eCFR script compares `latestAmendedOn` dates from the eCFR API against a local checkpoint to detect which titles have new amendments. The USC script checks for new OLRC release points. The FR script uses date-range filtering.

All converters use `writeFileIfChanged()` internally, so unchanged sections keep their original file timestamps. This means downstream tools (Shiki highlighting, Meilisearch indexing) automatically skip reprocessing unchanged content.

## Output Granularity

The `--granularity` (or `-g`) flag controls how much content goes into each file. You can convert the same source at different granularity levels to different output directories:

### Section Granularity (Default)

One Markdown file per legal section. Best for search indexing, RAG pipelines, and fine-grained retrieval.

```bash
lexbuild convert-usc --all -g section -o ./output/section
```

Produces ~60,000 files for USC, ~200,000 for eCFR. Each file is typically 1-50 KB.

### Chapter / Part Granularity

One file per chapter (USC) or part (eCFR). Sections are inlined under their parent headings.

```bash
lexbuild convert-usc --all -g chapter -o ./output/chapter
lexbuild convert-ecfr --all -g part -o ./output/part
```

Produces 2,000-5,000 files. Each file is typically 50-500 KB.

### Title Granularity

One file per title. The entire title hierarchy is rendered as nested headings.

```bash
lexbuild convert-usc --all -g title -o ./output/title
```

Produces 54 files for USC, 50 for eCFR. Files can be large (1-100 MB). Title-level files include extra frontmatter fields: `chapter_count`, `section_count`, and `total_token_estimate`.

> [!NOTE]
> The `-o` flag appends source subdirectories automatically. `convert-usc -o /some/path` writes to `/some/path/usc/`, not `/some/path/` directly.

## API Alternative

If you do not need local files, you can access all content programmatically through the LexBuild API without downloading anything:

```bash
# List USC sections in Title 42
curl "https://lexbuild.dev/api/usc/documents?title_number=42&limit=100"

# Get a single section as raw Markdown
curl -H "Accept: text/markdown" \
  "https://lexbuild.dev/api/usc/documents/t42/s1395"

# Get a single eCFR section
curl -H "Accept: text/markdown" \
  "https://lexbuild.dev/api/ecfr/documents/t17/s240.10b-5"
```

The API supports pagination, filtering, and three response formats (JSON, Markdown, plaintext). See [API Overview](/docs/api/overview) for authentication details.

## Working with the Output

LexBuild output files are standalone Markdown. You can work with them using any text processing tool:

```bash
# Search for a term across the corpus
rg "due process" output/ --glob "*.md" -l

# Count total sections per source
find output/usc/sections -name "section-*.md" | wc -l
find output/ecfr/sections -name "section-*.md" | wc -l

# Extract all identifiers from frontmatter
rg "^identifier:" output/usc/ --glob "*.md"

# View a section
cat output/usc/sections/title-17/chapter-01/section-107.md
```

Each file can be imported into databases, fed to LLMs, indexed in search engines, or processed by any tool that reads text.

## Directory Structure

After a full conversion at section granularity, the output directory looks like this:

```
output/
├── usc/
│   └── sections/
│       ├── title-01/
│       │   ├── _meta.json
│       │   ├── README.md
│       │   ├── chapter-01/
│       │   │   ├── _meta.json
│       │   │   ├── README.md
│       │   │   ├── section-1.md
│       │   │   └── section-2.md
│       │   └── chapter-02/
│       │       └── ...
│       └── title-02/
│           └── ...
├── ecfr/
│   └── sections/
│       ├── title-01/
│       │   └── ...
│       └── ...
└── fr/
    └── documents/
        ├── 2026/
        │   ├── 01/
        │   │   ├── 2026-00001.md
        │   │   └── ...
        │   └── ...
        └── ...
```

The `_meta.json` files in each directory provide a machine-readable index of all children, useful for building navigation or listing contents without parsing every Markdown file.

## Next Steps

- [CLI Commands](/docs/cli/commands) -- Full command reference with all flags and options
- [Output Format](/docs/cli/output-format) -- Frontmatter schema, sidecar files, and token estimates
- [RAG Pipeline Integration](/docs/guides/rag-pipeline) -- Feed the corpus into AI systems
- [Legal Research](/docs/guides/legal-research) -- Cross-reference statutes, regulations, and FR documents
