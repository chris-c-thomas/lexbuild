# CLAUDE.md — @lexbuild/usc

## Package Overview

`@lexbuild/usc` provides U.S. Code-specific conversion and download logic. It depends entirely on `@lexbuild/core` for XML parsing, AST building, and Markdown rendering. This package orchestrates the pipeline: download XML from OLRC, parse via `ASTBuilder`, resolve cross-references, write Markdown files, and generate sidecar metadata.

## Module Structure

```
src/
├── index.ts              # Barrel exports
├── converter.ts          # Main conversion orchestrator
├── converter.test.ts     # 20 test cases
├── snapshot.test.ts      # Output stability snapshots
├── downloader.ts         # OLRC XML download + bulk zip handling + auto-detection
├── downloader.test.ts    # 17 test cases
├── release-points.ts     # OLRC release point auto-detection and history (scrapes OLRC pages)
└── release-points.test.ts # 16 test cases
```

## Public API

Key exports (see `index.ts` for full list):

| Export | Purpose |
|--------|---------|
| `convertTitle()` | Convert a USC XML file to Markdown at any granularity |
| `downloadTitles()` | Download USC XML from OLRC (auto-detects latest release point) |
| `detectLatestReleasePoint()` | Scrape OLRC download page for current release point |
| `fetchReleasePointHistory()` | Scrape OLRC prior releases page for full release history |
| `FALLBACK_RELEASE_POINT` | Fallback release point when auto-detection fails |
| `USC_TITLE_NUMBERS` | Array `[1, 2, ..., 54]` |

## Conversion Pipeline

```
Input XML → [1] createReadStream
          → [2] XMLParser (SAX events)
          → [3] ASTBuilder.onEmit → collected: CollectedSection[]
          → [4] Two-pass linking (section granularity only)
          → [5] Write phase (varies by granularity)
          → [6] writeMetaFiles() (_meta.json + README.md)
```

### Collect-Then-Write Pattern

Sections are collected synchronously during SAX parsing (no async I/O in SAX event handlers). All file writes happen after parsing completes. This avoids backpressure issues and enables two-pass duplicate detection and link resolution.

```typescript
const collected: CollectedSection[] = [];
const builder = new ASTBuilder({
  emitAt: granularity,
  onEmit: (node, context) => {
    collected.push({ node, context }); // synchronous, no await
  },
});
// ... parse stream ...
// After parsing: iterate collected[], render, write files
```

### Granularity-Specific Output

| Granularity | Output | Metadata |
|---|---|---|
| `section` (default) | `usc/title-NN/chapter-NN/section-N.md` | `_meta.json` per chapter + title, `README.md` per title |
| `chapter` | `usc/title-NN/chapter-NN/chapter-NN.md` | `_meta.json` per title, `README.md` per title |
| `title` | `usc/title-NN.md` | Enriched frontmatter only (no sidecar files) |

## Key Edge Cases

### Duplicate Sections

Some titles have multiple sections with the same number in a chapter (e.g., Title 5 `§ 3598` x2).

- First pass counts occurrences per `chapterDir/sectionNum` key
- Suffix `-2`, `-3` appended to subsequent occurrences
- Both canonical and suffixed identifiers registered in link resolver
- Output: `section-3598.md`, `section-3598-2.md`

### Appendix Titles

Titles 5, 11, 18, 28 have appendices. Detected by `docNumber` regex (`"5a"`) or `<appendix>` ancestor element. Output directory: `title-05-appendix/`.

### Chapter Equivalents

Not all chapter-level containers are `<chapter>` elements:

- `<compiledAct>` → slugified heading as directory name
- `<reorganizationPlan>` → slugified heading as directory name
- Root-level sections (no chapter ancestor) → placed in title root

### Intermediate Big Levels in Chapters

Chapters containing subchapters, parts, or divisions are handled by recursive traversal. Big levels emit Markdown headings at increasing depth; sections within are rendered at the appropriate heading level.

### Title-Level Memory

Title granularity holds the entire AST in memory during rendering. Large titles (26, 42) can require 500MB+ RSS. Section and chapter granularity stream and release nodes.

## Downloader

### Release Point Auto-Detection

The downloader auto-detects the latest OLRC release point by scraping the download page (`https://uscode.house.gov/download/download.shtml`). When `options.releasePoint` is not provided, `downloadTitles()` calls `detectLatestReleasePoint()` which extracts the release point from download URL hrefs in the page HTML. Falls back to `FALLBACK_RELEASE_POINT` if the page is unreachable or unparseable.

The `--release-point` CLI flag overrides auto-detection for reproducible builds.

### Download Modes

Two download modes:

1. **All 54 titles** — single HTTP request for `xml_uscAll@{release}.zip`, extracts all `usc{NN}.xml` files. Falls back to per-title if bulk fails.
2. **Specific titles** — per-title requests for `xml_usc{NN}@{release}.zip`.

Uses `yauzl` for streaming zip extraction. Regex `/^(?:.*\/)?usc(\d{2})\.xml$/` matches XML files at any zip depth.

