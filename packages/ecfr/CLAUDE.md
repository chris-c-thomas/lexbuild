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
└── downloader.ts            # Download eCFR XML from govinfo
```

## Public API

| Export | Type | Purpose |
|--------|------|---------|
| `convertEcfrTitle()` | Function | Convert an eCFR XML file to Markdown |
| `downloadEcfrTitles()` | Function | Download eCFR XML from govinfo bulk data |
| `buildEcfrDownloadUrl()` | Function | Build download URL for a single title |
| `EcfrASTBuilder` | Class | SAX→AST builder for GPO/SGML XML |
| `ECFR_TITLE_COUNT` | Constant | `50` |
| `ECFR_TITLE_NUMBERS` | Constant | Array `[1, 2, ..., 50]` |
| Element classification sets | Constants | `ECFR_TYPE_TO_LEVEL`, `ECFR_DIV_ELEMENTS`, etc. |

## eCFR XML Schema

**Source**: `https://www.govinfo.gov/bulkdata/ECFR/title-{N}/ECFR-title{N}.xml`

**Format**: GPO/SGML-derived XML — no namespace declarations, no XSD schema. NOT USLM.

### Document Root Structure

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

No Dublin Core metadata, no release point, no positive law flag. Metadata is minimal compared to USLM.

### DIV Hierarchy

The eCFR uses numbered DIV elements where the `TYPE` attribute determines semantic meaning. **DIV2 is skipped** — the hierarchy goes DIV1 → DIV3 → DIV5 → DIV8.

| Element | TYPE | LevelType | N format | Notes |
|---------|------|-----------|---------|-------|
| `DIV1` | `TITLE` | `title` | Numeric (`1`, `17`) | Root |
| ~~`DIV2`~~ | ~~`SUBTITLE`~~ | ~~`subtitle`~~ | — | **Not observed** in Titles 1 or 17 |
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
| **Pass-through** | Transparent, no frame | `DLPSTEXTCLASS`, `TEXT`, `BODY`, `ECFRBRWS` |
| **Skip** | Skip self (no subtree) | `PTHD`, `CHAPTI`, `RESERVED`, `PG`, `STARS`, `AMDDATE`, etc. |

## Conversion Pipeline

```
eCFR XML → [XMLParser(defaultNamespace: "")] → SAX events
  → [EcfrASTBuilder] → collected sections/parts + partNotes map
  → [Pass 1] Compute output paths, detect duplicates, register all identifiers
  → [Pass 2] Render + write .md files (forward & backward cross-refs resolve)
  → Write _meta.json + README.md (section granularity)
```

For chapter granularity, sections are emitted individually then grouped by chapter ancestor into composite files. For part/title granularity, nodes are filtered to the target level.

## ConvertOptions

```typescript
{
  input: string;
  output: string;
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

```
https://www.govinfo.gov/bulkdata/ECFR/title-{N}/ECFR-title{N}.xml
```

Individual XML files per title (not ZIP archives). 50 titles total.

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
- **DIV2 (SUBTITLE) not observed** — hierarchy skips from DIV1 to DIV3
- **SUBJGRP (DIV7)** is organizational only, not a legal subdivision — mapped to `subpart`
- **Tables are HTML, not GPOTABLE** — the refactor plan's GPOTABLE assumption was wrong
- **AUTH/SOURCE at part level** — these notes appear on DIV5, not DIV8 sections. The builder captures them in a `partNotes` map (keyed by part identifier) during parsing; the converter enriches section frontmatter from this map.
- **Section headings include number prefix** — `<HEAD>§ 1.1   Definitions.</HEAD>` — builder strips the `§ N.N` prefix
- **Lowercase `div` wrappers** around tables — handled as pass-through/ignore in the builder
- **Multi-volume titles** — large titles (e.g., Title 17) have multiple DIV1 elements, one per volume. The `N` attribute on DIV1 is the volume number, not the title number. The builder extracts the title number from the `NODE` attribute prefix (e.g., `NODE="17:1"` → `17`).
- **CFR chapter numbers are Roman numerals** — `chapter_number` (typed as `number`) is only set when the value parses as an integer. Roman numeral chapter designators (I, II, IV) are captured in `chapter_name` instead.
- **Reserved titles** — Title 35 (Panama Canal) has no bulk XML on govinfo. The downloader silently skips reserved titles via the `RESERVED_TITLES` set.

## Dependency on @lexbuild/core

Imports: `XMLParser`, `LevelNode`, `EmitContext`, `AncestorInfo`, `renderDocument`, `createLinkResolver`, `FORMAT_VERSION`, `GENERATOR`.

Does NOT import from `@lexbuild/usc`. Source packages are independent.
