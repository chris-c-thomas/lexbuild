# @lexbuild/ecfr

eCFR source package for LexBuild. Converts Electronic Code of Federal Regulations XML (GPO/SGML-derived format from ecfr.gov or govinfo) into structured Markdown. This package includes its own AST builder (`EcfrASTBuilder`) because the eCFR XML format is fundamentally different from USLM -- it uses DIV-based hierarchy, has no namespace declarations, and uses flat paragraph elements rather than nested subsection structures.

The package depends on `@lexbuild/core` for the XML parser, AST types, Markdown renderer, frontmatter generator, link resolver, and resilient file I/O. It does not depend on `@lexbuild/usc` -- source packages are independent by design.

## Module Map

```
packages/ecfr/src/
  index.ts                 # Barrel exports
  converter.ts             # Conversion orchestrator (collect-then-write)
  ecfr-builder.ts          # eCFR SAX --> AST state machine
  ecfr-elements.ts         # GPO/SGML element classification (DIV types, emphasis codes)
  ecfr-frontmatter.ts      # Build FrontmatterData from eCFR context
  ecfr-path.ts             # Output path builder
  downloader.ts            # Download from govinfo bulk data
  ecfr-api-downloader.ts   # Download from ecfr.gov API (default, daily-updated)
```

## Public API

| Export | Type | Purpose |
|--------|------|---------|
| `convertEcfrTitle(options)` | Function | Convert a single eCFR XML file to Markdown |
| `downloadEcfrTitles(options)` | Function | Download eCFR XML from govinfo bulk data |
| `downloadEcfrTitlesFromApi(options)` | Function | Download eCFR XML from ecfr.gov API (default) |
| `fetchEcfrTitlesMeta()` | Function | Fetch title metadata and currency dates from API |
| `buildEcfrDownloadUrl(title)` | Function | Build govinfo download URL for a single title |
| `buildEcfrApiDownloadUrl(title, date)` | Function | Build ecfr.gov API download URL for a single title |
| `EcfrASTBuilder` | Class | SAX-to-AST builder for GPO/SGML XML |
| `ECFR_TITLE_COUNT` | Constant | `50` |
| `ECFR_TITLE_NUMBERS` | Constant | Array `[1, 2, ..., 50]` |
| Element classification sets | Constants | `ECFR_TYPE_TO_LEVEL`, `ECFR_DIV_ELEMENTS`, `ECFR_CONTENT_ELEMENTS`, `ECFR_INLINE_ELEMENTS`, `ECFR_EMPHASIS_MAP`, `ECFR_NOTE_ELEMENTS`, `ECFR_HEADING_ELEMENTS`, `ECFR_BLOCK_ELEMENTS`, `ECFR_IGNORE_ELEMENTS`, `ECFR_PASSTHROUGH_ELEMENTS`, `ECFR_SKIP_ELEMENTS`, `ECFR_REF_ELEMENTS`, `ECFR_TABLE_ELEMENTS` |

Key type exports: `EcfrConvertOptions`, `EcfrConvertResult`, `EcfrDownloadOptions`, `EcfrDownloadResult`, `EcfrApiDownloadOptions`, `EcfrApiDownloadResult`, `EcfrASTBuilderOptions`, `EcfrTitleMeta`, `EcfrTitlesResponse`.

## eCFR XML Format

The eCFR uses GPO/SGML-derived XML that is completely different from the USLM 1.0 schema used by the U.S. Code:

- No namespace declarations (all elements are bare names)
- No XSD schema
- DIV-based hierarchy where the `TYPE` attribute determines semantic meaning
- Flat content paragraphs (`P`) with numbering prefixes like `(a)`, `(1)`, `(i)` rather than nested subsection elements
- Two sources provide this XML with slightly different wrapper structures

### Document Root Structure

Two sources provide eCFR XML with different outer wrappers but the same inner element vocabulary.

**govinfo bulk XML:**

```xml
<DLPSTEXTCLASS>
  <HEADER>...</HEADER>
  <TEXT><BODY><ECFRBRWS>
    <DIV1 N="1" NODE="1:1" TYPE="TITLE">
      <!-- Title content -->
    </DIV1>
  </ECFRBRWS></BODY></TEXT>
</DLPSTEXTCLASS>
```

**ecfr.gov API XML:**

```xml
<ECFR>
  <VOLUME N="1" AMDDATE="..."/>
  <DIV1 N="1" TYPE="TITLE">
    <!-- Title content (no NODE attributes, no section number prefix) -->
  </DIV1>
</ECFR>
```

Key API differences: no `HEADER` or `CFRTOC`, no `NODE` attribute on elements, no `§` prefix on section `N` values, and single `DIV1` for multi-volume titles. The builder handles both formats transparently without source detection.

### DIV Hierarchy

The eCFR uses numbered DIV elements (`DIV1` through `DIV9`) where the `TYPE` attribute determines which level in the regulatory hierarchy the element represents. Not all DIV numbers are used -- `DIV2` (subtitle) is uncommon, and the hierarchy typically skips directly from `DIV1` to `DIV3`.

| Element | TYPE | LevelType | N Format | Notes |
|---------|------|-----------|----------|-------|
| `DIV1` | `TITLE` | `title` | Numeric (`1`, `17`) | Root level |
| `DIV2` | `SUBTITLE` | `subtitle` | Letter (`A`, `B`) | Present in some titles (e.g., Title 2) |
| `DIV3` | `CHAPTER` | `chapter` | Roman numeral (`I`, `II`, `IV`) | Major grouping |
| `DIV4` | `SUBCHAP` | `subchapter` | Letter (`A`, `B`) | |
| `DIV5` | `PART` | `part` | Numeric (`1`, `240`) | Primary regulatory unit |
| `DIV6` | `SUBPART` | `subpart` | Letter (`A`, `B`) | |
| `DIV7` | `SUBJGRP` | `subpart` | Numeric | Organizational only, not a legal subdivision |
| `DIV8` | `SECTION` | `section` | `§ N.N` (`§ 1.1`, `§ 240.10b-5`) | Atomic regulatory unit |
| `DIV9` | `APPENDIX` | `appendix` | Text (`Appendix A`) | Part-level appendix |

Each DIV element carries three key attributes: `N` (display number or label), `NODE` (hierarchical position ID like `"17:1.0.1.1.1.0.1.1"` -- govinfo only), and `TYPE` (semantic level). The `NODE` attribute is not a USLM-style identifier; the builder constructs CFR identifiers from `NODE` and `N` values: `NODE="17:..." + N="§ 1.1"` produces `/us/cfr/t17/s1.1`.

### Section Structure

Unlike USLM's nested `<subsection>`, `<paragraph>`, `<clause>` hierarchy, eCFR sections contain flat `<P>` elements with numbering prefixes:

```xml
<DIV8 N="§ 1.1" NODE="1:1.0.1.1.1.0.1.1" TYPE="SECTION">
  <HEAD>§ 1.1   Definitions.</HEAD>
  <P>(a) <I>Act</I> means the Commodity Exchange Act...</P>
  <P>(b) <I>Commission</I> means the Commodity Futures Trading Commission.</P>
  <CITA TYPE="N">[41 FR 3194, Jan. 21, 1976]</CITA>
</DIV8>
```

The builder treats these flat paragraphs as content blocks rather than nested levels.

### Content Elements

| Element | Purpose |
|---------|---------|
| `P` | Paragraph (primary content element) |
| `FP` | Flush paragraph (no indent) |
| `FP-1`, `FP-2` | Indented flush paragraphs (levels 1 and 2) |
| `FP-DASH` | Dash-leader flush paragraph (form lines) |
| `FP1-2`, `FRP` | Alternative paragraph variants |
| `EXTRACT` | Extracted or quoted text block |
| `EXAMPLE` | Illustrative example block |
| `HD1`, `HD2`, `HD3` | Sub-headings within sections or appendices |

### Inline Formatting

The `E` element uses a `T` attribute code to indicate formatting:

| T Value | Rendering | Typical Usage |
|---------|-----------|---------------|
| `"01"` | Bold | General emphasis |
| `"02"` | Italic | Definitions, terms |
| `"03"` | Bold | Bold italic in print |
| `"04"` | Italic | Headings, labels |
| `"05"` | Italic | Small caps (exhibit labels) |
| `"51"`, `"52"`, `"54"` | Subscript | Math notation |
| `"7462"` | Italic | Special terms (et seq.) |

Other inline elements: `I` (italic), `B` (bold), `SU` (superscript and footnote markers), `FR` (fraction), `AC` (accent/diacritical), `XREF` (cross-reference with `ID`/`REFID` attributes), `FTREF` (footnote reference marker).

### Note Elements

| Element | Note Type | Structure |
|---------|-----------|-----------|
| `AUTH` | `authority` | `<HED>Authority:</HED><PSPACE>text</PSPACE>` |
| `SOURCE` | `regulatorySource` | `<HED>Source:</HED><PSPACE>text</PSPACE>` |
| `CITA` | `citation` | Direct text: `[37 FR 23603, Nov. 4, 1972]` |
| `EDNOTE` | `editorial` | `<HED>Editorial Note:</HED><PSPACE>text</PSPACE>` |
| `EFFDNOT` | `effectiveDate` | `<HED>Effective Date Note:</HED><PSPACE>text</PSPACE>` |
| `APPRO` | `approval` | Direct text: `(Approved by OMB...)` |
| `NOTE` | `general` | `<HED>Note:</HED><P>text</P>` |
| `CROSSREF` | `crossReference` | `<HED>Cross Reference:</HED><P>text</P>` |
| `SECAUTH` | `sectionAuthority` | Direct text: `(Sec. 10; 48 Stat. 891; ...)` |
| `FTNT` | `footnote` | `<P><SU>1</SU> Text...</P>` |

`AUTH` and `SOURCE` notes appear at the part level (`DIV5`), before sections. `CITA` appears within sections, typically as the last element. `SECAUTH` and `APPRO` appear within sections. `EDNOTE` appears after `CITA` or at part level.

### Table Elements

eCFR uses HTML-style tables (`TABLE`, `TR`, `TH`, `TD`), not the GPOTABLE format used by the annual CFR. Tables are wrapped in `<DIV class="gpotbl_div">` wrappers (lowercase `div`).

### Element Classification

The builder classifies every element into one of four handling categories:

| Category | Behavior | Elements |
|----------|----------|----------|
| Ignore | Skip entire subtree | `CFRTOC`, `HEADER` |
| Pass-through | Transparent wrapper, no frame | `DLPSTEXTCLASS`, `TEXT`, `BODY`, `ECFRBRWS`, `ECFR` |
| Skip | Skip element itself (no subtree concern) | `PTHD`, `CHAPTI`, `RESERVED`, `PG`, `STARS`, `AMDDATE`, `VOLUME` |
| Process | Route to element-specific handler | DIV, content, inline, note, heading, table elements |

## EcfrASTBuilder

`EcfrASTBuilder` is a stack-based state machine that consumes SAX events from the XML parser and produces [LexBuild AST nodes](../architecture/ast-model.md). It follows the same emit-at-level pattern as the USLM builder in core: when the closing tag of an element at the configured emit level is reached, the completed subtree fires through the `onEmit` callback and is released for garbage collection.

Key behaviors:

- **DIV type mapping.** Incoming DIV elements are classified by their `TYPE` attribute using the `ECFR_TYPE_TO_LEVEL` map. The element name (`DIV1`, `DIV5`, etc.) determines document depth but the `TYPE` determines semantic meaning.
- **Flat paragraph handling.** `P` elements with numbering prefixes like `(a)`, `(1)`, `(i)` are treated as content blocks, not nested levels. The builder does not attempt to reconstruct USLM-style subsection nesting.
- **Identifier construction.** CFR identifiers are built from `NODE` and `N` attributes using the `/us/cfr/` prefix. For example, a section with `NODE="17:..."` and `N="§ 240.10b-5"` produces `/us/cfr/t17/s240.10b-5`.
- **Part notes capture.** `AUTH` and `SOURCE` notes at the part level are stored in a `partNotes` map keyed by part identifier during parsing. The converter enriches section frontmatter from this map after parsing completes.
- **Dual root handling.** The builder handles both govinfo bulk XML (`DLPSTEXTCLASS` root) and ecfr.gov API XML (`ECFR` root) transparently -- both wrapper structures are classified as pass-through.
- **Multi-volume titles.** Large titles (e.g., Title 17) have multiple `DIV1` elements in govinfo XML, one per volume. The `N` attribute on `DIV1` is the volume number, not the title number. The builder extracts the title number from the `NODE` attribute prefix.
- **Section heading cleanup.** `<HEAD>` elements in sections include the section number prefix (e.g., `§ 1.1   Definitions.`). The builder strips the `§ N.N` prefix to produce a clean heading.

## Converter

`convertEcfrTitle()` orchestrates the full conversion pipeline using the same [collect-then-write pattern](../architecture/conversion-pipeline.md#the-collect-then-write-pattern) as `@lexbuild/usc`:

1. **Parse.** Stream the XML file through `XMLParser` (configured with empty default namespace) into `EcfrASTBuilder`.
2. **Collect.** Emitted `{ node, context }` pairs accumulate in an array during synchronous SAX processing.
3. **Pass 1.** Compute output paths, detect duplicate section numbers, register all identifiers with the link resolver.
4. **Pass 2.** Render each section to Markdown (with cross-reference resolution) and write `.md` files using resilient file I/O.
5. **Pass 3.** Write `_meta.json` and `README.md` sidecar files (section granularity only).

### ConvertOptions

```typescript
interface EcfrConvertOptions {
  input: string;                    // Path to eCFR XML file
  output: string;                   // Output root directory
  granularity: "section" | "part" | "chapter" | "title";
  linkStyle: "relative" | "canonical" | "plaintext";
  includeSourceCredits: boolean;
  includeNotes: boolean;
  includeEditorialNotes: boolean;
  includeStatutoryNotes: boolean;
  includeAmendments: boolean;
  dryRun: boolean;
}
```

### Granularity Modes

| Mode | emitAt | Output Path | Sidecar Metadata |
|------|--------|-------------|------------------|
| Section (default) | `section` | `ecfr/title-NN/chapter-X/part-N/section-N.N.md` | `_meta.json` per part and title, `README.md` per title |
| Part | `part` | `ecfr/title-NN/chapter-X/part-N.md` | None |
| Chapter | `section`* | `ecfr/title-NN/chapter-X/chapter-X.md` | None |
| Title | `title` | `ecfr/title-NN.md` | None (enriched frontmatter only) |

\* eCFR chapter granularity emits at section level, then groups sections by chapter ancestor into composite files during the write phase.

Title granularity holds the entire AST and rendered Markdown in memory. Large eCFR titles (Title 40 exceeds 150 MB XML) can require significant resident memory.

### Output Path Conventions

- Title directories: `title-01` through `title-50` (zero-padded to 2 digits)
- Chapter directories: `chapter-{X}` with Roman numeral designators (`chapter-I`, `chapter-IV`)
- Part directories: `part-{N}` (`part-1`, `part-240`)
- Section files: `section-{N.N}.md` using the part-prefixed section number (`section-1.1.md`, `section-240.10b-5.md`)

## Downloaders

### ecfr.gov API (Default)

The primary download source uses the eCFR versioner API, which provides daily-updated, point-in-time XML:

```
https://www.ecfr.gov/api/versioner/v1/full/{YYYY-MM-DD}/title-{N}.xml
```

No API key is required. The date defaults to the current currency date from the titles endpoint unless `--date` is specified. The API supports `?part=N` and `?section=N.N` query filters for fetching subsets of a title.

Title metadata and currency dates are available from:

```
https://www.ecfr.gov/api/versioner/v1/titles
```

The downloader uses per-title `up_to_date_as_of` dates for accuracy. When the global `meta.import_in_progress` flag is set, the global `meta.date` may return 404, so the downloader falls back to the previous day. Individual titles with `processing_in_progress: true` return 503 for any date until processing completes; the downloader retries transient errors (503/504) with exponential backoff.

### govinfo Bulk Data (Fallback)

The fallback source provides bulk XML from the govinfo distribution endpoint:

```
https://www.govinfo.gov/bulkdata/ECFR/title-{N}/ECFR-title{N}.xml
```

Files are plain XML (not ZIP archives). Title numbers are not zero-padded (`title-1`, not `title-01`). Updates irregularly -- govinfo can lag months behind ecfr.gov for stable titles.

### Reserved Titles

Title 35 (Panama Canal) is reserved. Both sources return 404 for this title. The downloaders silently skip reserved titles during `--all` downloads via the `RESERVED_TITLES` set.

Output files use the same naming convention (`ECFR-title{N}.xml`) regardless of source, so `convert-ecfr` works identically with either.

## Frontmatter

eCFR sections include all standard LexBuild frontmatter fields plus source-specific additions:

| Field | Value | Notes |
|-------|-------|-------|
| `source` | `"ecfr"` | Discriminates from USC output |
| `legal_status` | `"authoritative_unofficial"` | eCFR is not official legal evidence |
| `positive_law` | `false` | Regulations, not legislation |
| `authority` | Authority citation text | From `AUTH` note at part level |
| `regulatory_source` | Publication source text | From `SOURCE` note at part level |
| `cfr_part` | Part number | Numeric CFR part |

All identifiers use the `/us/cfr/` prefix (not `/us/ecfr/`). Both eCFR and any future annual CFR package share the same identifier space since they represent the same underlying regulatory content.

## Dependency on @lexbuild/core

Imports from core: `XMLParser`, `LevelNode`, `EmitContext`, `AncestorInfo`, `DocumentMeta`, `RenderOptions`, `NotesFilter`, `ASTNode`, `renderDocument`, `createLinkResolver`, `FORMAT_VERSION`, `GENERATOR`, `writeFile`, `mkdir`.

See the [Core Package](./core.md) documentation for details on these shared components and the [Conversion Pipeline](../architecture/conversion-pipeline.md) for the end-to-end data flow.
