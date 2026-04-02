# CLAUDE.md — @lexbuild/ecfr

## Package Overview

`@lexbuild/ecfr` converts Electronic Code of Federal Regulations (eCFR) bulk XML to structured Markdown. It depends on `@lexbuild/core` for XML parsing, AST types, and Markdown rendering. The eCFR uses GPO/SGML-derived XML — a completely different format from USLM 1.0 used by the U.S. Code.

## Module Structure

```
src/
├── index.ts                 # Barrel exports
├── ecfr-elements.ts         # GPO/SGML element classification (DIV types, emphasis codes)
├── ecfr-builder.ts          # SAX → AST state machine for eCFR XML
├── ecfr-builder.test.ts     # 12 unit tests
├── ecfr-frontmatter.ts      # Build FrontmatterData from eCFR context
├── ecfr-path.ts             # Output path builder
├── converter.ts             # Conversion orchestrator (collect-then-write)
├── downloader.ts            # Download eCFR XML from govinfo bulk data
├── ecfr-api-downloader.ts   # Download eCFR XML from ecfr.gov API (daily-updated)
└── ecfr-api-downloader.test.ts  # 5 unit tests
```

## Public API

Key exports (see `index.ts` for full list):

| Export | Purpose |
|--------|---------|
| `convertEcfrTitle()` | Convert an eCFR XML file to Markdown |
| `downloadEcfrTitles()` | Download eCFR XML from govinfo bulk data |
| `downloadEcfrTitlesFromApi()` | Download eCFR XML from ecfr.gov API (default) |
| `fetchEcfrTitlesMeta()` | Fetch title metadata and currency dates from API |
| `EcfrASTBuilder` | SAX→AST builder for GPO/SGML XML |

## eCFR XML Schema

**Sources**:
- **eCFR API (default)**: `https://www.ecfr.gov/api/versioner/v1/full/{date}/title-{N}.xml` — daily-updated, point-in-time
- **govinfo bulk**: `https://www.govinfo.gov/bulkdata/ECFR/title-{N}/ECFR-title{N}.xml` — updates irregularly

**Format**: GPO/SGML-derived XML — no namespace declarations, no XSD schema. NOT USLM. Both sources use the same element vocabulary (DIV1-DIV9, HEAD, P, AUTH, etc.) but differ in wrapper structure.

### Document Root Structure

**govinfo bulk XML**:
```xml
<DLPSTEXTCLASS>        <!-- pass-through wrapper -->
  <HEADER>...</HEADER>  <!-- skipped (minimal metadata) -->
  <TEXT><BODY><ECFRBRWS>
    <DIV1 N="1" NODE="1:1" TYPE="TITLE">
      <!-- Title content -->
    </DIV1>
  </ECFRBRWS></BODY></TEXT>
</DLPSTEXTCLASS>
```

**eCFR API XML**:
```xml
<ECFR>                 <!-- pass-through wrapper -->
  <VOLUME N="1" AMDDATE="..."/>  <!-- skipped -->
  <DIV1 N="1" TYPE="TITLE">
    <!-- Title content (no NODE attributes, no § prefix on section N) -->
  </DIV1>
</ECFR>
```

Key API differences: no `HEADER`/`CFRTOC`, no `NODE` attribute, no `§` prefix on section `N` values, single `DIV1` for multi-volume titles (N = title number directly). The builder handles both formats transparently — no source detection needed.

### DIV Hierarchy

The eCFR uses numbered DIV elements where the `TYPE` attribute determines semantic meaning. **DIV2 is skipped** — the hierarchy goes DIV1 → DIV3 → DIV5 → DIV8.

| Element | TYPE | LevelType | N format | Notes |
|---------|------|-----------|---------|-------|
| `DIV1` | `TITLE` | `title` | Numeric (`1`, `17`) | Root |
| `DIV2` | `SUBTITLE` | `subtitle` | Letter (`A`, `B`) | Present in some titles (e.g., Title 2) |
| `DIV3` | `CHAPTER` | `chapter` | Roman (`I`, `II`) | Major grouping |
| `DIV4` | `SUBCHAP` | `subchapter` | Letter (`A`, `B`) | |
| `DIV5` | `PART` | `part` | Numeric (`1`, `240`) | Primary regulatory unit |
| `DIV6` | `SUBPART` | `subpart` | Letter (`A`, `B`) | |
| `DIV7` | `SUBJGRP` | `subpart` | Numeric (`1`–`6`) | Organizational only, not a legal subdivision |
| `DIV8` | `SECTION` | `section` | `§ N.N` (`§ 1.1`, `§ 240.10b-5`) | Atomic regulatory unit |
| `DIV9` | `APPENDIX` | `appendix` | Text (`Appendix A`) | Part-level appendix |

**Key DIV attributes**: `N` (display number/label), `NODE` (hierarchical position ID like `"17:1.0.1.1.1.0.1.1"`), `TYPE` (semantic level).

The `NODE` attribute is NOT a USLM-style identifier. The builder constructs CFR-style identifiers: `NODE="17:..." + N="§ 1.1"` → `/us/cfr/t17/s1.1`.

### Section Structure

```xml
<DIV8 N="§ 1.1" NODE="1:1.0.1.1.1.0.1.1" TYPE="SECTION">
  <HEAD>§ 1.1   Definitions.</HEAD>
  <P>(a) <I>Act</I> means the Commodity Exchange Act...</P>
  <P>(b) <I>Commission</I> means the Commodity Futures Trading Commission.</P>
  <CITA TYPE="N">[41 FR 3194, Jan. 21, 1976]</CITA>
</DIV8>
```

**Subsections are NOT nested elements.** Unlike USLM's `<subsection>`, `<paragraph>`, `<clause>` nesting, eCFR uses flat `<P>` elements with numbering prefixes like `(a)`, `(1)`, `(i)`.

### Content Elements

| Element | Purpose |
|---------|---------|
| `P` | Paragraph (primary content) |
| `FP` | Flush paragraph (no indent) |
| `FP-1`, `FP-2` | Indented flush paragraphs |
| `FP-DASH` | Dash-leader flush paragraph (form lines) |
| `FP1-2`, `FRP` | Alternative paragraph variants |
| `EXTRACT` | Extracted/quoted text block |
| `EXAMPLE` | Illustrative example block |
| `HD1`, `HD2`, `HD3` | Sub-headings within sections/appendices |

### Inline Formatting

**E element** (emphasis with T attribute codes):

| T Value | Rendering | Usage |
|---------|-----------|-------|
| `"01"` | Bold | General emphasis |
| `"02"` | Italic | Definitions, terms |
| `"03"` | Bold | Bold italic in print |
| `"04"` | Italic | Headings, labels |
| `"05"` | Italic | Small caps (exhibit labels) |
| `"51"`, `"52"`, `"54"` | Subscript | Math notation |
| `"7462"` | Italic | Special terms (et seq.) |

**Other inlines**: `I` (italic), `B` (bold), `SU` (superscript/footnote markers), `FR` (fraction), `XREF` (cross-reference with `ID`/`REFID` attrs), `FTREF` (footnote reference marker).

### Note Elements

| Element | noteType | Structure |
|---------|----------|-----------|
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

**Note placement**: `AUTH` and `SOURCE` appear at the PART level (DIV5), before sections. `CITA` appears within sections, typically last. `SECAUTH` and `APPRO` appear within sections. `EDNOTE` appears after CITA or at part level.

### Table Elements

eCFR uses **HTML-style tables** (`TABLE`, `TR`, `TH`, `TD`), NOT GPOTABLE format. Tables are wrapped in `<DIV class="gpotbl_div">` wrappers (lowercase `div`).

### Element Classification in Builder

| Category | Behavior | Elements |
|----------|----------|----------|
| **Ignore** | Skip entire subtree | `CFRTOC`, `HEADER` |
| **Pass-through** | Transparent, no frame | `DLPSTEXTCLASS`, `TEXT`, `BODY`, `ECFRBRWS`, `ECFR` |
| **Skip** | Skip self (no subtree) | `PTHD`, `CHAPTI`, `RESERVED`, `PG`, `STARS`, `AMDDATE`, `VOLUME`, etc. |

## Conversion Pipeline

```
eCFR XML → [XMLParser(defaultNamespace: "")] → SAX events
  → [EcfrASTBuilder] → collected sections/parts + partNotes map
  → [Pass 1] Compute output paths, detect duplicates, register all identifiers
  → [Pass 2] Render + write .md files (forward & backward cross-refs resolve)
  → Write _meta.json + README.md (section granularity)
```

For chapter granularity, sections are emitted individually then grouped by chapter ancestor into composite files. For part/title granularity, nodes are filtered to the target level.

## Output Structure

```
output/ecfr/
├── title-01/
│   ├── chapter-I/
│   │   ├── part-1/
│   │   │   ├── section-1.1.md
│   │   │   └── _meta.json
│   │   └── part-2/
│   │       ├── section-2.1.md
│   │       ├── section-2.2.md
│   │       └── _meta.json
│   ├── _meta.json
│   └── README.md
└── title-17/
    └── ...
```

## Download URLs

**eCFR API (default)**:
```
https://www.ecfr.gov/api/versioner/v1/full/{YYYY-MM-DD}/title-{N}.xml
```
Point-in-time full title XML. Date defaults to current currency date from `/api/versioner/v1/titles`. Supports `?part=N` and `?section=N.N` query filters. Daily-updated.

**govinfo bulk data**:
```
https://www.govinfo.gov/bulkdata/ECFR/title-{N}/ECFR-title{N}.xml
```
Individual XML files per title (not ZIP archives). Updates irregularly.

50 titles total, 49 with content (Title 35 is reserved).

## Frontmatter Fields

eCFR sections include all standard fields plus:
- `source: "ecfr"`
- `legal_status: "authoritative_unofficial"`
- `authority` — regulatory authority citation (from part-level AUTH)
- `regulatory_source` — publication source (from part-level SOURCE)
- `cfr_part` — CFR part number
- `positive_law: false` (regulations, not legislation)

## Common Pitfalls

- **HEADER is fully skipped** — metadata comes from DIV1 attributes, not HEADER elements
- **DIV2 (SUBTITLE) present in some titles** — e.g., Title 2 has Subtitle A/B containing chapters. Parts can nest directly under a subtitle without an intermediate chapter.
- **SUBJGRP (DIV7)** is organizational only, not a legal subdivision — mapped to `subpart`
- **Tables are HTML, not GPOTABLE** — the refactor plan's GPOTABLE assumption was wrong
- **AUTH/SOURCE at part level** — these notes appear on DIV5, not DIV8 sections. The builder captures them in a `partNotes` map (keyed by part identifier) during parsing; the converter enriches section frontmatter from this map.
- **Section headings include number prefix** — `<HEAD>§ 1.1   Definitions.</HEAD>` — builder strips the `§ N.N` prefix
- **Lowercase `div` wrappers** around tables — handled as pass-through/ignore in the builder
- **Multi-volume titles** — large titles (e.g., Title 17) have multiple DIV1 elements, one per volume. The `N` attribute on DIV1 is the volume number, not the title number. The builder extracts the title number from the `NODE` attribute prefix (e.g., `NODE="17:1"` → `17`).
- **CFR chapter numbers are Roman numerals** — `chapter_number` (typed as `number`) is only set when the value parses as an integer. Roman numeral chapter designators (I, II, IV) are captured in `chapter_name` instead.
- **Reserved titles** — Title 35 (Panama Canal) has no bulk XML on govinfo and returns 404 from the eCFR API. Both downloaders silently skip reserved titles via the `RESERVED_TITLES` set.
- **eCFR API vs govinfo XML** — both use the same element vocabulary but differ in wrappers. The builder handles both transparently: `ECFR` root (API) is passthrough, `VOLUME` element (API) is skipped, `§` prefix stripping handles both `"§ 1.1"` (govinfo) and `"1.1"` (API), NODE absence is handled gracefully.
- **eCFR API import-in-progress** — The `/titles` endpoint's `meta.import_in_progress` flag means the global `meta.date` may return 404. The downloader falls back to the previous day. Individual titles can also have `processing_in_progress: true`, returning 503 for ANY date until processing completes. The downloader uses per-title `up_to_date_as_of` dates and retries transient errors (503/504) with exponential backoff.

