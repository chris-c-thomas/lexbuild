# @lexbuild/usc

`@lexbuild/usc` is the U.S. Code source package for LexBuild. It orchestrates the full conversion pipeline for USLM 1.0 XML files published by the Office of the Law Revision Counsel (OLRC), and provides a downloader for fetching those files from OLRC's website. The package depends entirely on `@lexbuild/core` for XML parsing, AST building, and Markdown rendering -- it contains no parsing or rendering logic of its own. Instead, it handles pipeline orchestration, file I/O, output directory structure, metadata generation, and the many edge cases specific to the U.S. Code's structure.

## Module Map

```
packages/usc/src/
  index.ts              # Barrel exports
  converter.ts          # Main conversion orchestrator (~1,230 lines)
  converter.test.ts     # 15+ test cases covering all granularity modes
  snapshot.test.ts      # Output stability snapshots
  downloader.ts         # OLRC XML download + bulk zip handling (~418 lines)
  downloader.test.ts    # 15+ test cases
```

The package is lean by design: two main modules (converter and downloader) plus their tests. All the heavy lifting of XML parsing, AST construction, and Markdown rendering is delegated to `@lexbuild/core`.

---

## Converter

**File**: `packages/usc/src/converter.ts`

### convertTitle()

```typescript
async function convertTitle(options: ConvertOptions): Promise<ConvertResult>;
```

This is the primary public API. It takes a single USC XML file and produces Markdown output at the specified granularity.

### ConvertOptions

```typescript
interface ConvertOptions {
  input: string;                    // Path to the input XML file
  output: string;                   // Output directory root
  granularity: "section" | "chapter" | "title";
  linkStyle: "relative" | "canonical" | "plaintext";
  includeSourceCredits: boolean;    // Default: true
  includeNotes: boolean;            // Default: true (all notes)
  includeEditorialNotes: boolean;   // Selective (when includeNotes is false)
  includeStatutoryNotes: boolean;   // Selective
  includeAmendments: boolean;       // Selective
  dryRun: boolean;                  // Parse only, no file writes
}
```

**Note flag logic**: the `includeNotes` flag is a blanket toggle. When any selective flag (`includeEditorialNotes`, `includeStatutoryNotes`, `includeAmendments`) is set to `true`, the blanket `includeNotes` flag is automatically disabled to prevent conflicts. This logic is handled at the CLI layer, but the converter also implements it via `buildNotesFilter()`.

### ConvertResult

```typescript
interface ConvertResult {
  sectionsWritten: number;          // Sections written (or would-be-written in dry-run)
  files: string[];                  // Output file paths (empty in dry-run)
  titleNumber: string;              // Extracted from XML metadata
  titleName: string;                // Extracted from XML metadata
  dryRun: boolean;
  chapterCount: number;
  totalTokenEstimate: number;       // character/4 heuristic
  peakMemoryBytes: number;          // Peak RSS during conversion
}
```

For section and chapter granularity, `sectionsWritten` counts the number of individual sections processed (even in chapter mode, where multiple sections are inlined into each chapter file). For title granularity, it counts all sections found in the title's AST.

### The 7-Step Pipeline

Each call to `convertTitle()` executes this pipeline:

1. **Create ReadStream** -- opens the XML file with `fs.createReadStream()`.
2. **SAX Parsing** -- pipes the stream through `XMLParser.parseStream()`, which feeds events to the `ASTBuilder`.
3. **AST Collection** -- the builder's `onEmit` callback collects completed nodes into a `CollectedSection[]` array. This is synchronous -- no async I/O happens during SAX event processing.
4. **Duplicate Detection** (section granularity only) -- a first pass counts section numbers per chapter directory, computing disambiguation suffixes (`-2`, `-3`) for duplicates.
5. **Link Registration** (section granularity with relative links) -- a second pass registers all section identifiers with a `LinkResolver` before any rendering begins, so cross-references within the same title can resolve.
6. **Write Phase** -- iterates over collected nodes, rendering each to Markdown with frontmatter and writing to disk. The write function varies by granularity: `writeSection()`, `writeChapter()`, or `writeWholeTitle()`.
7. **Metadata Generation** -- `writeMetaFiles()` produces `_meta.json` and `README.md` files for section and chapter granularity. Skipped entirely for title granularity.

See [Conversion Pipeline](../architecture/conversion-pipeline.md) for a visual diagram of this flow.

---

## Collect-Then-Write Pattern

The most important architectural pattern in this package is the separation of parsing from writing.

During SAX streaming, the `onEmit` callback fires synchronously as each section (or chapter, or title) closes. The callback collects nodes into an in-memory array:

```typescript
const collected: CollectedSection[] = [];
const builder = new ASTBuilder({
  emitAt: granularity,
  onEmit: (node, context) => {
    collected.push({ node, context });  // synchronous, no await
  },
});
await parser.parseStream(stream);
// After parsing: iterate collected[], render, write files
```

This pattern exists for three reasons:

1. **SAX events are synchronous**. The `saxes` parser emits events synchronously during `write()` calls. Performing async I/O (file writes) inside event handlers would require complex backpressure management and could interleave writes with parsing in unpredictable ways.

2. **Two-pass duplicate detection**. Section-level output needs to detect duplicate section numbers before assigning filenames. This requires a full pass over all collected sections to count occurrences per chapter before any files are written.

3. **Two-pass link resolution**. When `linkStyle` is `"relative"`, all section identifiers must be registered with the `LinkResolver` before rendering begins, so that cross-references encountered during rendering can resolve to their target files.

The tradeoff is memory: all emitted nodes are held in memory simultaneously. For section-level granularity, each node is a single section (typically small). For title-level granularity, the single emitted node is the entire title AST, which can require 500MB+ RSS for large titles like Title 26 (Internal Revenue Code) or Title 42.

---

## Granularity Modes

### Section Granularity (Default)

One Markdown file per section. This is the default and most common mode.

**Output structure**:
```
output/usc/title-01/chapter-01/section-1.md
output/usc/title-01/chapter-01/section-2.md
output/usc/title-01/chapter-01/_meta.json
output/usc/title-01/_meta.json
output/usc/title-01/README.md
```

**ASTBuilder emit level**: `"section"` -- each section's closing tag triggers emission.

**Write function**: `writeSection()` renders each section independently with its own frontmatter, then writes to `section-{N}.md`. The link resolver enables cross-references between sections within the same title.

**Metadata**: `_meta.json` is generated at both chapter and title levels. Chapter metadata lists all sections with token estimates. Title metadata aggregates chapter stats. A `README.md` is generated at the title level with a chapter listing.

### Chapter Granularity

One Markdown file per chapter, with all sections inlined.

**Output structure**:
```
output/usc/title-01/chapter-01/chapter-01.md
output/usc/title-01/_meta.json
output/usc/title-01/README.md
```

**ASTBuilder emit level**: `"chapter"` -- each chapter's closing tag triggers emission.

**Write function**: `writeChapter()` renders the chapter heading as H1, then recursively renders children. Sections within the chapter become H2, subsections within those use bold inline numbering. Intermediate big levels (subchapters, parts) get headings at increasing depth via `renderChapterChildren()`.

**Metadata**: `_meta.json` at title level only (no chapter-level sidecar, since each chapter is a single file). `sectionsWritten` in the result uses `sectionMetas.length` rather than `files.length`, since one file contains many sections.

### Title Granularity

One Markdown file per title -- the entire title hierarchy in a single document.

**Output structure**:
```
output/usc/title-01.md
```

**ASTBuilder emit level**: `"title"` -- only the title's closing tag triggers emission. The entire AST is held in memory.

**Write function**: `writeWholeTitle()` renders the title heading as H1, then recursively renders the full hierarchy via `renderTitleChildren()`. Chapters become H2, subchapters H3, and so on. Sections get headings at the current depth (capped at H6 via `Math.min(headingLevel - 1, 5)`). Structural headings beyond H5 fall back to bold text to keep sections visually distinct.

**Metadata**: none. No `_meta.json`, no `README.md`, no sidecar files. Instead, the frontmatter is enriched with `chapter_count`, `section_count`, and `total_token_estimate`. The token estimate is computed from the full rendered body length (including structural headings), not just section content.

**Memory**: this mode holds the entire title AST in memory during rendering. Large titles require 500MB+ RSS. This is documented as a known tradeoff.

---

## Downloader

**File**: `packages/usc/src/downloader.ts`

### downloadTitles()

```typescript
async function downloadTitles(options: DownloadOptions): Promise<DownloadResult>;
```

Downloads USC title XML files from OLRC, extracts them from ZIP archives, and writes the raw XML to the output directory.

### DownloadOptions

```typescript
interface DownloadOptions {
  outputDir: string;
  titles?: number[];         // Specific titles, or undefined for all 54
  releasePoint?: string;     // Default: CURRENT_RELEASE_POINT
}
```

### Download Modes

**All 54 titles** -- when `titles` is undefined or covers all 54 numbers, the downloader fetches a single bulk ZIP (`xml_uscAll@{release}.zip`). This is one HTTP request instead of 54. If the bulk download fails, it falls back to per-title downloads automatically.

**Specific titles** -- for a subset of titles, individual ZIPs are fetched: `xml_usc{NN}@{release}.zip` for each requested title.

### Release Points

The `CURRENT_RELEASE_POINT` constant (currently `"119-73not60"`) identifies which public laws are incorporated into the XML. The format is `{congress}-{law}[not{excluded}]`. For example, `119-73not60` means "through Public Law 119-73, excluding Public Law 119-60."

The release point is hardcoded because OLRC does not provide a machine-readable API for discovering the latest release. Updates require changing this constant in source and publishing a new version. The CLI provides a `--release-point` override for advanced users.

### URL Construction

```typescript
function buildDownloadUrl(titleNumber: number, releasePoint: string): string;
function buildAllTitlesUrl(releasePoint: string): string;
function releasePointToPath(releasePoint: string): string;
```

URLs follow the pattern:
```
https://uscode.house.gov/download/releasepoints/us/pl/{congress}/{law}/xml_usc{NN}@{releasePoint}.zip
```

The `releasePointToPath()` function converts `"119-73not60"` to `"119/73not60"` for the URL path segment.

### ZIP Extraction

The downloader uses `yauzl` for streaming ZIP extraction. The regex `/^(?:.*\/)?usc(\d{2})\.xml$/` matches XML files at any depth within the ZIP. For the bulk download, `extractAllXmlFromZip()` extracts every matching file. For single-title downloads, `extractXmlFromZip()` extracts the first matching XML file. ZIP files are deleted after successful extraction.

### DownloadResult

```typescript
interface DownloadResult {
  releasePoint: string;
  files: DownloadedFile[];    // { titleNumber, filePath, size }
  errors: DownloadError[];    // { titleNumber, message }
}
```

Partial failures are supported: if some titles fail to download, the successful ones are still reported. The CLI displays both the success table and individual error messages.

---

## Edge Cases

### Duplicate Section Numbers

Some titles contain multiple sections with the same number within a chapter (e.g., Title 5 has two `Section 3598` entries in the same chapter).

The converter handles this with a two-pass approach:

1. **First pass**: count occurrences of each `chapterDir/sectionNum` key across all collected sections.
2. **Second pass**: assign disambiguation suffixes (`-2`, `-3`) to subsequent occurrences.

Output: `section-3598.md` (first occurrence), `section-3598-2.md` (second occurrence).

Both the canonical identifier and the suffixed identifier are registered with the link resolver, so cross-references to either can resolve.

### Appendix Titles

Titles 5, 11, 18, and 28 have appendices that are published as separate XML documents with `docNumber` values like `"5a"`. These are detected by:

- Regex match on `docNumber`: `/^(\d+)a$/i`
- Presence of an `<appendix>` ancestor element in the context

Appendix titles output to separate directories: `title-05-appendix/` rather than `title-05/`.

### Chapter Equivalents

Not all chapter-level containers are `<chapter>` elements. The converter recognizes several alternatives:

| XML Element | Directory Name |
|---|---|
| `<chapter>` | `chapter-{NN}` (zero-padded) |
| `<compiledAct>` | Slugified heading (e.g., `federal-advisory-committee-act`) |
| `<reorganizationPlan>` | Slugified heading |
| `<reorganizationPlans>` | `reorganization-plans` |
| Root-level sections (no chapter ancestor) | Placed directly in the title directory |

The `buildChapterDir()` function walks the context ancestors in priority order: chapter, then compiledAct, then reorganizationPlan, then reorganizationPlans.

### Intermediate Big Levels

Chapters can contain subchapters, parts, divisions, and other big levels between the chapter and its sections. The `renderChapterChildren()` and `renderTitleChildren()` functions handle this recursively:

- Big-level children emit headings at increasing depth.
- Heading level is capped at H5 (big-level headings beyond H5 become bold text).
- Sections within any nesting depth are rendered at the appropriate heading offset.

### Quoted Content Suppression

`<section>` elements can appear inside `<quotedContent>` blocks (quoted bills in statutory notes). The `ASTBuilder` tracks `quotedContentDepth` to suppress emission of these sections as standalone output files. They are rendered inline within the note's blockquote instead.

### Empty and Repealed Sections

Sections with status values like `"repealed"`, `"transferred"`, or `"reserved"` may contain only a note or be entirely empty. These still produce output files with appropriate frontmatter. The `status` field in the frontmatter indicates the section's legal state.

---

## Internal Helpers

| Function | Purpose |
|---|---|
| `padTwo(n)` | Zero-pad single digits (`"1"` becomes `"01"`), pass through multi-digit or alphanumeric |
| `parseIntSafe(s)` | Parse an integer, return `0` if NaN |
| `findAncestor(ancestors, levelType)` | Walk the ancestors array to find the first match for a level type |
| `stripSourceCredits(node)` | Shallow-copy a `LevelNode` with `SourceCreditNode` children filtered out |
| `buildChapterDir(context)` | Determine the chapter directory name from context (chapter, compiledAct, reorganizationPlan) |
| `buildTitleDir(context)` | Determine the title directory name, handling appendix titles |
| `buildTitleDirFromDocNumber(docNum)` | Convert `"5"` to `"title-05"`, `"5a"` to `"title-05-appendix"` |
| `buildFrontmatter(node, context)` | Construct `FrontmatterData` from a section node and its emit context |
| `buildSectionMetaDryRun(node, chapter, context)` | Estimate content length by walking AST text nodes (no rendering) |
| `buildNotesFilter(options)` | Convert `ConvertOptions` note flags into a `NotesFilter` or `undefined` |
| `extractSourceCreditText(node)` | Recursively extract plain text from a section's `SourceCreditNode` children |
| `parseCurrency(pubName)` | Extract release point from `docPublicationName` (e.g., `"Online@119-73not60"` becomes `"119-73"`) |
| `parseDate(dateStr)` | Parse ISO timestamp to date-only format |

---

## Dependency on @lexbuild/core

This package imports the following from `@lexbuild/core`:

**Classes**: `XMLParser`, `ASTBuilder`

**Functions**: `renderDocument`, `renderSection`, `renderNode`, `generateFrontmatter`, `createLinkResolver`

**Types**: `LevelNode`, `ASTNode`, `EmitContext`, `FrontmatterData`, `RenderOptions`, `NotesFilter`, `AncestorInfo`, `LinkResolver`

**Constants**: `BIG_LEVELS`, `FORMAT_VERSION`, `GENERATOR`

No custom element handlers are implemented in this package. All USLM element handling lives in core's `ASTBuilder`. The USC package's role is pipeline orchestration and output management, not XML interpretation.

See [Output Format](../reference/output-format.md) for the complete specification of the Markdown output structure.
