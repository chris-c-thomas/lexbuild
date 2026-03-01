# Phase 3 Handoff — Complete

**Date**: 2026-03-01
**Branch**: `feat/phase3`
**Version**: v0.3.0
**Last commit**: `47d3879 feat(usc): handle duplicate section numbers and verify status edge cases`

---

## Phase 3 Status

All 8 tasks complete.

| # | Task | Status |
|---|------|--------|
| 26 | OLRC downloader with zip extraction | COMPLETE |
| 27 | `law2md download` CLI command | COMPLETE |
| 28 | `--dry-run` mode | COMPLETE |
| 29 | Progress reporting (memory, tokens, timing) | COMPLETE |
| 30 | Appendix title handling | COMPLETE |
| 31 | Edge cases: repealed/reserved/duplicate sections | COMPLETE |
| 32 | Memory profiling (Title 26, Title 42) | COMPLETE |
| 33 | E2E test: convert all 54 titles | COMPLETE |

## Task Details

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

### Task 31: Edge Cases
- **Duplicate section disambiguation**: sections sharing the same number within a chapter (Title 5 §3598, §5757) produce separate files with `-2` suffix (`section-3598.md`, `section-3598-2.md`). Both listed in `_meta.json`.
- **Status handling**: sections with `status` attributes (repealed, reserved, transferred, etc.) include status in YAML frontmatter. All sections report status in `_meta.json` (defaulting to `"current"`).
- Added `fileName` field to `SectionMeta` so `_meta.json` uses actual filenames instead of reconstructing them.
- 5 new tests: duplicate disambiguation (3 tests), status in frontmatter and `_meta.json` (2 tests).
- New fixtures: `duplicate-sections.xml`, `section-with-status.xml`

### Task 32: Memory Profiling
- Title 26 (53MB XML, IRC): 2,160 sections, 72 chapters, **401 MB peak RSS**, 1.14s
- Title 42 (107MB XML, Public Health): 8,460 sections, 195 chapters, **661 MB peak RSS**, 2.85s
- Title 42 exceeds original 512MB target — accepted as reasonable for the single largest title. Only 2 of 54 titles exceed 50MB XML.

### Task 33: E2E All 54 Titles
- 58 files processed (54 titles + 4 appendices): **58/58 passed, 0 failures**
- 60,261 total sections written
- 2,714 `_meta.json` files generated
- 495 MB total output
- **25 seconds** total elapsed (well under 30-minute target)
- 3 appendices (11a, 28a, 50a) produce 0 sections — known limitation (courtRules without sections)

---

## Test Coverage

| Package | Tests | Files |
|---------|-------|-------|
| `@law2md/core` | 90 | 8 test files |
| `@law2md/usc` | 27 | 3 test files |
| `law2md` (CLI) | 4 | 1 test file |
| **Total** | **121** | **12 test files** |

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

### Duplicate Section Handling
- Tracks seen section numbers per chapter via `Map<string, number>` keyed on `chapterDir/sectionNum`
- First occurrence: no suffix. Subsequent: `-2`, `-3`, etc.
- Suffix propagated to: output path, `relativeFile`, `fileName` in SectionMeta, link resolver registration, `_meta.json` file field

## Key File Locations

| File | Purpose |
|------|---------|
| `packages/usc/src/downloader.ts` | OLRC download + zip extraction |
| `packages/usc/src/converter.ts` | Main conversion pipeline (850+ lines) |
| `packages/core/src/ast/builder.ts` | XML→AST with section-emit pattern (900+ lines) |
| `packages/core/src/markdown/renderer.ts` | AST→Markdown (500+ lines) |
| `packages/core/src/markdown/links.ts` | Cross-reference link resolver |
| `packages/core/src/markdown/frontmatter.ts` | YAML frontmatter generator |
| `packages/cli/src/commands/convert.ts` | CLI convert command |
| `packages/cli/src/commands/download.ts` | CLI download command |
