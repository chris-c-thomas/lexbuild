# CLAUDE.md — @lexbuild/usc

## Package Overview

`@lexbuild/usc` provides U.S. Code-specific conversion and download logic. It depends entirely on `@lexbuild/core` for XML parsing, AST building, and Markdown rendering. This package orchestrates the pipeline: download XML from OLRC, parse via `ASTBuilder`, resolve cross-references, write Markdown files, and generate sidecar metadata.

## Module Structure

```
src/
├── index.ts              # Barrel exports
├── converter.ts          # Main conversion orchestrator (1,232 lines)
├── converter.test.ts     # 15+ test cases
├── snapshot.test.ts      # Output stability snapshots
├── downloader.ts         # OLRC XML download + bulk zip handling + auto-detection
├── downloader.test.ts    # 15+ test cases
└── release-points.ts     # OLRC release point auto-detection (scrapes download page)
```

## Public API

| Export | Type | Purpose |
|--------|------|---------|
| `convertTitle()` | Function | Convert a USC XML file to Markdown at any granularity |
| `downloadTitles()` | Function | Download USC XML from OLRC (auto-detects latest release point) |
| `detectLatestReleasePoint()` | Function | Scrape OLRC download page for current release point |
| `parseReleasePointFromHtml()` | Function | Parse release point from HTML (exported for testing) |
| `buildDownloadUrl()` | Function | Build download URL for a single title |
| `buildAllTitlesUrl()` | Function | Build download URL for all titles as one zip |
| `releasePointToPath()` | Function | Convert `"119-73not60"` → `"119/73not60"` |
| `isAllTitles()` | Function | Check if title list covers all 54 USC titles |
| `FALLBACK_RELEASE_POINT` | Constant | Fallback release point when auto-detection fails |
| `CURRENT_RELEASE_POINT` | Constant | Deprecated alias for `FALLBACK_RELEASE_POINT` |
| `USC_TITLE_NUMBERS` | Constant | Array `[1, 2, ..., 54]` |
| `ConvertOptions` | Type | Input options for `convertTitle()` |
| `ConvertResult` | Type | Conversion result (sections written, files, tokens, memory) |
| `DownloadOptions` | Type | Input options for `downloadTitles()` |
| `DownloadResult` | Type | Download result (titles downloaded, files, bytes, stats) |
| `DownloadedFile` | Type | Metadata for a single downloaded file (path, title, size, release point) |
| `DownloadError` | Type | Error type for download failures (wraps underlying I/O/network errors) |
| `ReleasePointInfo` | Type | Detected release point with description |

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

## ConvertOptions

```typescript
{
  input: string;                    // XML file path
  output: string;                   // Output root directory
  granularity: "section" | "chapter" | "title";
  linkStyle: "relative" | "canonical" | "plaintext";
  includeSourceCredits: boolean;
  includeNotes: boolean;            // All notes
  includeEditorialNotes: boolean;   // Selective
  includeStatutoryNotes: boolean;   // Selective
  includeAmendments: boolean;       // Selective
  dryRun: boolean;                  // Parse only, no writes
}
```

## Internal Helpers

| Function | Purpose |
|---|---|
| `padTwo(n)` | Zero-pad single digits (`1` → `"01"`), pass through multi-digit/alphanumeric |
| `parseIntSafe(s)` | Parse int, return 0 if NaN |
| `findAncestor(ancestors, levelType)` | Walk ancestors backward to find first match |
| `stripSourceCredits(node)` | Shallow-copy node with sourceCredit children filtered out |
| `buildChapterDir(context)` | Determine chapter directory name from context (chapter, compiledAct, reorgPlan) |
| `buildSectionMetaDryRun(node)` | Estimate content length by walking AST (no rendering) |

## Dependency on @lexbuild/core

This package imports and uses: `XMLParser`, `ASTBuilder`, `LevelNode`, `EmitContext`, `DocumentMeta`, `renderDocument`, `renderSection`, `renderNode`, `generateFrontmatter`, `createLinkResolver`, `BIG_LEVELS`, `FORMAT_VERSION`, `GENERATOR`.

No custom element handlers are implemented — all USLM element handling lives in core's `ASTBuilder`.
