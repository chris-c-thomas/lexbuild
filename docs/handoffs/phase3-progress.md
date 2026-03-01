# Phase 3 Handoff — In Progress

**Date**: 2026-03-01
**Branch**: `feat/phase3`
**Last commit**: `6c25445 feat(core,usc): handle appendix titles with separate output directories`

---

## Phase 3 Status

5 of 8 tasks complete. 3 remaining.

| # | Task | Status |
|---|------|--------|
| 26 | OLRC downloader with zip extraction | COMPLETE |
| 27 | `law2md download` CLI command | COMPLETE |
| 28 | `--dry-run` mode | COMPLETE |
| 29 | Progress reporting (memory, tokens, timing) | COMPLETE |
| 30 | Appendix title handling | COMPLETE |
| 31 | Edge cases: repealed/reserved/duplicate sections | **IN PROGRESS** |
| 32 | Memory profiling (Title 26, Title 42) | PENDING (blocked by 29) |
| 33 | E2E test: convert all 54 titles | PENDING (blocked by 26-32) |

## What's Done in Phase 3

### Task 26: OLRC Downloader
- `packages/usc/src/downloader.ts` — `downloadTitles()`, `buildDownloadUrl()`, `buildAllTitlesUrl()`
- Hardcoded `CURRENT_RELEASE_POINT = "119-73not60"` with `--release-point` override
- Native `fetch` → zip → `yauzl` extraction → cleanup
- URL pattern: `https://uscode.house.gov/download/releasepoints/us/pl/{congress}/{lawSuffix}/xml_usc{NN}@{releasePoint}.zip`
- Release points can have exclusion suffixes (e.g., `119-73not60`)

### Task 27: Download CLI
- `packages/cli/src/commands/download.ts` — `law2md download --title N`, `--all`, `-o`, `--release-point`
- Reports per-title file sizes, elapsed time

### Task 28: Dry-Run Mode
- `--dry-run` flag on convert command
- Parses XML, walks AST for content length estimation, reports chapters/sections/tokens/time/memory without writing files
- Added `dryRun`, `chapterCount`, `totalTokenEstimate`, `peakMemoryBytes` to `ConvertResult`

### Task 29: Progress Reporting
- `peakMemoryBytes` tracked via `process.memoryUsage.rss()` at start, after parse, after write
- Verbose mode shows token estimate + peak memory
- Non-verbose shows chapter count in summary line

### Task 30: Appendix Titles
- Added `appendix`, `compiledAct`, `reorganizationPlans`, `reorganizationPlan`, `courtRules`, `courtRule` to `LEVEL_TYPES`, `BIG_LEVELS`, `LEVEL_ELEMENTS`
- `buildTitleDir()` detects appendix via docNumber format (`"5a"` → `title-05-appendix`)
- `buildChapterDir()` treats compiledAct/reorganizationPlan as chapter equivalents with slugified headings
- Works for Titles 5a (19 sections) and 18a (27 sections)
- Known limitation: Titles 11a and 28a use courtRules as atomic units (no sections inside) — produces 0 output

## What Remains

### Task 31: Edge Cases (IN PROGRESS — just started)
Handle sections with status values (repealed, reserved, transferred, renumbered, omitted) and duplicate section numbers.

**Status handling**: Already partially works — sections with `status` attributes produce files with `status` in frontmatter (verified with Title 5 appendix `status="transferred"` sections). Need to verify all status types render correctly.

**Duplicate section numbers**: Two sections in Title 5 (3598 and 5757) have the same number — second currently overwrites first. Need to append a disambiguation suffix to prevent data loss.

### Task 32: Memory Profiling
Run Title 26 (53MB, IRC) and Title 42 (107MB, Public Health) with memory tracking. Verify peak RSS < 512MB. Both XML files are available in `fixtures/xml/`.

### Task 33: E2E All 54 Titles
Convert all 54 titles. Verify no crashes, all produce output, complete in < 30 minutes. This is the Phase 3 exit criteria validation.

---

## Test Coverage

| Package | Tests | Files |
|---------|-------|-------|
| `@law2md/core` | 90 | 8 test files |
| `@law2md/usc` | 22 | 3 test files |
| `law2md` (CLI) | 4 | 1 test file |
| **Total** | **116** | **12 test files** |

## Technical Notes

### Downloader
- `yauzl` is callback-based — wrapped in promises
- `Readable.fromWeb()` used to pipe fetch response body to file (cast to `never` due to DOM/Node ReadableStream type mismatch)
- Zip files deleted after extraction
- `releasePointToPath()` splits on first hyphen: `"119-73not60"` → `"119/73not60"`

### Appendix Structure
- Appendix files are separate XML files (e.g., `usc05A.xml`)
- Root element: `<uscDoc>` with `<appendix>` inside (not `<title>`)
- `docNumber` includes "a" suffix: `"5a"`, `"11a"`, `"18a"`, `"28a"`
- `dc:type` is `"USCTitleAppendix"`
- Sections live inside `<compiledAct>` or `<courtRules>/<courtRule>` containers
- `<reorganizationPlan>` elements are individual plans, nested under `<reorganizationPlans>`

### Dry-Run AST Walking
- `buildSectionMetaDryRun()` recursively walks AST nodes counting text content length
- Uses same `SectionMeta` interface as normal mode but without rendering overhead

## Key File Locations

| File | Purpose |
|------|---------|
| `packages/usc/src/downloader.ts` | OLRC download + zip extraction |
| `packages/usc/src/converter.ts` | Main conversion pipeline (750+ lines) |
| `packages/core/src/ast/builder.ts` | XML→AST with section-emit pattern (900+ lines) |
| `packages/core/src/markdown/renderer.ts` | AST→Markdown (500+ lines) |
| `packages/core/src/markdown/links.ts` | Cross-reference link resolver |
| `packages/core/src/markdown/frontmatter.ts` | YAML frontmatter generator |
| `packages/cli/src/commands/convert.ts` | CLI convert command |
| `packages/cli/src/commands/download.ts` | CLI download command |
