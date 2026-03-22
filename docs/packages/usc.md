# @lexbuild/usc

U.S. Code source package. Orchestrates the full conversion pipeline for USLM 1.0 XML from the Office of the Law Revision Counsel (OLRC) and provides a downloader for bulk XML files. The package depends on `@lexbuild/core` for XML parsing, AST building, and Markdown rendering -- it contains no parsing or rendering logic itself. Instead it handles pipeline orchestration, file I/O, output directory structure, metadata generation, and the many edge cases specific to the U.S. Code.

## Module Map

```
packages/usc/src/
  index.ts              # Barrel exports
  converter.ts          # Main conversion orchestrator
  downloader.ts         # OLRC XML download + zip handling
  release-points.ts     # OLRC release point auto-detection
```

## Public API

### Functions

| Export | Description |
|--------|-------------|
| `convertTitle(options)` | Convert a USC XML file to Markdown at any granularity |
| `downloadTitles(options)` | Download USC XML from OLRC (auto-detects latest release point) |
| `detectLatestReleasePoint()` | Scrape the OLRC download page for the current release point |
| `parseReleasePointFromHtml(html)` | Parse release point from HTML (exported for testing) |
| `buildDownloadUrl(titleNumber, releasePoint)` | Build the download URL for a single title's ZIP |
| `buildAllTitlesUrl(releasePoint)` | Build the download URL for the all-titles bulk ZIP |
| `releasePointToPath(releasePoint)` | Convert `"119-73not60"` to URL path `"119/73not60"` |
| `isAllTitles(titles)` | Check if a title list covers all 54 USC titles |

### Constants

| Export | Value | Description |
|--------|-------|-------------|
| `USC_TITLE_NUMBERS` | `[1, 2, ..., 54]` | All valid USC title numbers |
| `FALLBACK_RELEASE_POINT` | `"119-73not60"` | Used only when auto-detection fails |

### Types

`ConvertOptions`, `ConvertResult`, `DownloadOptions`, `DownloadResult`, `DownloadedFile`, `DownloadError`, `ReleasePointInfo`

## Converter

### ConvertOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `input` | `string` | -- | Path to the input XML file |
| `output` | `string` | -- | Output directory root |
| `granularity` | `"section" \| "chapter" \| "title"` | `"section"` | Output granularity |
| `linkStyle` | `"relative" \| "canonical" \| "plaintext"` | `"plaintext"` | Cross-reference rendering |
| `includeSourceCredits` | `boolean` | `true` | Include source credits |
| `includeNotes` | `boolean` | `true` | Include all notes |
| `includeEditorialNotes` | `boolean` | `false` | Selective: editorial notes only |
| `includeStatutoryNotes` | `boolean` | `false` | Selective: statutory notes only |
| `includeAmendments` | `boolean` | `false` | Selective: amendment history only |
| `dryRun` | `boolean` | `false` | Parse and report structure without writing files |

When `includeNotes` is `true` (the default), all notes are included regardless of the selective filters. When `includeNotes` is `false`, the selective filters (`includeEditorialNotes`, `includeStatutoryNotes`, `includeAmendments`) control which categories appear.

### ConvertResult

| Field | Type | Description |
|-------|------|-------------|
| `sectionsWritten` | `number` | Number of sections written (or projected in dry-run) |
| `files` | `string[]` | Output paths of all written files (empty in dry-run) |
| `titleNumber` | `string` | Title number from document metadata |
| `titleName` | `string` | Title name from document metadata |
| `dryRun` | `boolean` | Whether this was a dry run |
| `chapterCount` | `number` | Number of distinct chapters |
| `totalTokenEstimate` | `number` | Estimated total tokens (character/4 heuristic) |
| `peakMemoryBytes` | `number` | Peak RSS during conversion |

### The Pipeline

Conversion proceeds in sequential phases:

**1. Stream setup.** Open a `ReadStream` on the input XML file.

**2. SAX parsing.** Wire `XMLParser` events (`openElement`, `closeElement`, `text`) to the `ASTBuilder`.

**3. AST collection.** The builder's `onEmit` callback pushes completed `LevelNode`/`EmitContext` pairs into a `CollectedSection[]` array. Collection is synchronous -- no async I/O occurs during SAX event processing. This is the collect-then-write pattern.

**4. Duplicate detection (section granularity).** A two-pass approach counts section numbers per chapter directory. The first pass builds a frequency map; the second assigns `-2`, `-3` suffixes to repeated numbers. Both canonical and suffixed identifiers are registered with the link resolver.

**5. Link registration (section granularity).** All identifiers are registered in a `LinkResolver` before any rendering occurs, so cross-references within the title resolve correctly in a single pass.

**6. Write phase.** Varies by granularity:
- Section: `writeSection()` renders and writes one `.md` file per section
- Chapter: `writeChapter()` renders all sections inline within a chapter file
- Title: `writeWholeTitle()` renders the entire title as a single file

**7. Metadata generation.** `writeMetaFiles()` produces `_meta.json` at the title and chapter levels, plus a `README.md` per title. Skipped for title granularity and dry-run mode.

## Granularity Modes

| Mode | emitAt | Output Path | Metadata |
|------|--------|-------------|----------|
| Section (default) | `section` | `usc/title-NN/chapter-NN/section-N.md` | `_meta.json` per chapter + title, `README.md` per title |
| Chapter | `chapter` | `usc/title-NN/chapter-NN/chapter-NN.md` | `_meta.json` per title, `README.md` per title |
| Title | `title` | `usc/title-NN.md` | Enriched frontmatter only (no sidecar files) |

Title numbers in directory names are zero-padded to 2 digits (`title-01` through `title-54`). Chapter numbers are also zero-padded (`chapter-01`). Section numbers are not zero-padded because they can be alphanumeric (e.g., `section-7801`, `section-106a`).

## Downloader

### Release Point Auto-Detection

**File**: `release-points.ts`

`detectLatestReleasePoint()` fetches the OLRC download page and extracts the current release point from download URL hrefs. Two extraction strategies provide redundancy:

1. Parse the release point from the `xml_uscAll@{rp}.zip` bulk download link
2. Fall back to any single-title link matching `xml_usc\d{2}@{rp}.zip`

Returns a `ReleasePointInfo` with the `releasePoint` string and a human-readable `description` parsed from the page heading. Returns `null` if the page is unreachable or its format has changed, in which case the caller falls back to `FALLBACK_RELEASE_POINT`.

The `--release-point` CLI flag overrides auto-detection for reproducible builds.

### Download Modes

**File**: `downloader.ts`

| Mode | Trigger | Behavior |
|------|---------|----------|
| All 54 titles | `--all` or all titles requested | Single HTTP request for `xml_uscAll@{rp}.zip`. Falls back to per-title if bulk fails. |
| Specific titles | `--titles 1,5,26` | Per-title requests for `xml_usc{NN}@{rp}.zip` |

Uses `yauzl` for streaming ZIP extraction. The bulk ZIP may contain XML files at any nesting depth; the extractor matches filenames with `/^(?:.*\/)?usc(\d{2})\.xml$/`.

### URL Pattern

```
https://uscode.house.gov/download/releasepoints/us/pl/{congress}/{law}/xml_usc{NN}@{releasePoint}.zip
```

`releasePointToPath()` converts `"119-73not60"` to `"119/73not60"` by splitting on the first hyphen.

## Edge Cases

### Duplicate Section Numbers

Some titles have multiple sections with the same number within a chapter (e.g., Title 5 has two sections numbered 3598). The converter uses a two-pass approach:

1. First pass counts occurrences per `chapterDir/sectionNum` key
2. Second pass assigns `-2`, `-3` suffixes to subsequent occurrences
3. Both the canonical identifier and the suffixed variant are registered with the link resolver

Output: `section-3598.md`, `section-3598-2.md`.

### Appendix Titles

Titles 5, 11, 18, 28 have appendices containing compiled acts, court rules, and reorganization plans. Appendices are detected by a `docNumber` regex (e.g., `"5a"`) or by an `<appendix>` ancestor element. Their output goes to a separate directory: `title-05-appendix/`.

### Chapter Equivalents

Not all chapter-level containers are `<chapter>` elements. The converter maps various structural elements to directory names:

| Element | Directory Name |
|---------|---------------|
| `chapter` | `chapter-{NN}` (zero-padded) |
| `compiledAct` | Slugified heading |
| `reorganizationPlan` | Slugified heading |
| Root-level sections | Title directory root (no chapter subdirectory) |

### Intermediate Big Levels

Chapters can contain subchapters, parts, divisions, and other big levels between the chapter and its sections. The converter handles these through recursive traversal (`renderChapterChildren` / `renderTitleChildren`), emitting Markdown headings at increasing depth. Big-level headings cap at H5; beyond that, bold text is used.

### Quoted Content Suppression

`<section>` elements inside `<quotedContent>` (quoted bills appearing in statutory notes) must not be emitted as standalone files. The AST builder tracks a `quotedContentDepth` counter and suppresses emission when the depth is greater than zero.

### Empty and Repealed Sections

Sections with status values like `"repealed"`, `"transferred"`, or `"omitted"` still produce output files. The section's `status` attribute is included in the frontmatter, and whatever content exists (typically a note explaining the repeal or transfer) is rendered normally.

## Dependency on @lexbuild/core

This package imports from `@lexbuild/core` and uses the following:

| Category | Imports |
|----------|---------|
| XML parsing | `XMLParser` |
| AST building | `ASTBuilder`, `LevelNode`, `EmitContext`, `AncestorInfo`, `BIG_LEVELS` |
| Rendering | `renderDocument`, `renderSection`, `renderNode`, `generateFrontmatter` |
| Link resolution | `createLinkResolver`, `LinkResolver` |
| Constants | `FORMAT_VERSION`, `GENERATOR` |
| File I/O | `writeFile`, `mkdir` |
| Types | `FrontmatterData`, `RenderOptions`, `NotesFilter` |

No custom element handlers are implemented in this package. All USLM element handling lives in core's `ASTBuilder`.
