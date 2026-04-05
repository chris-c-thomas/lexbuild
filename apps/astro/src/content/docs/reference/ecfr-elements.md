---
title: eCFR Element Reference
description: Complete catalog of elements in the GPO/SGML-derived XML format used by eCFR data, showing how each element maps to LexBuild AST nodes and renders to Markdown output.
order: 5
---

This is the complete element reference for the eCFR (Electronic Code of Federal Regulations) XML format. The eCFR uses a GPO/SGML-derived XML format with no namespace declarations and no formal XSD schema. Element names are uppercase. LexBuild handles XML from two sources -- the ecfr.gov API and govinfo bulk data -- both of which share the same element vocabulary but differ in their wrapper structure.

You will find this reference useful if you are extending the eCFR converter, debugging unexpected output, or building tooling that works with CFR XML directly.

## Document Structure

### ecfr.gov API Format

```xml
<ECFR>
  <VOLUME N="1" AMDDATE="..."/>
  <DIV1 N="1" TYPE="TITLE">
    <!-- Title content -->
  </DIV1>
</ECFR>
```

`<ECFR>` is a pass-through wrapper. The `<VOLUME>` element is skipped. Content begins directly at `<DIV1>`.

API-specific differences from govinfo: no `NODE` attribute on elements, no `§` prefix on section `N` values, single `<DIV1>` for multi-volume titles (where `N` is the title number directly).

### govinfo Bulk Format

```xml
<DLPSTEXTCLASS>
  <HEADER>...</HEADER>
  <TEXT>
    <BODY>
      <ECFRBRWS>
        <DIV1 N="1" NODE="1:1" TYPE="TITLE">
          <!-- Title content -->
        </DIV1>
      </ECFRBRWS>
    </BODY>
  </TEXT>
</DLPSTEXTCLASS>
```

`<DLPSTEXTCLASS>`, `<TEXT>`, `<BODY>`, and `<ECFRBRWS>` are pass-through wrappers. `<HEADER>` is fully ignored (metadata comes from DIV attributes, not the header).

The `EcfrASTBuilder` handles both formats transparently. No source detection is needed.

## DIV Hierarchy

The eCFR uses numbered DIV elements (DIV1 through DIV9) where the `TYPE` attribute determines the semantic level. The element number does not always correspond to a strict nesting depth; the hierarchy can skip DIV numbers (e.g., DIV1 directly containing DIV3 when there is no subtitle).

| Element | TYPE | LevelType | N Format | Description |
|---------|------|-----------|----------|-------------|
| `DIV1` | `TITLE` | `title` | Numeric (`1`, `17`) | Root level, one per title |
| `DIV2` | `SUBTITLE` | `subtitle` | Letter (`A`, `B`) | Present in some titles (e.g., Title 2) |
| `DIV3` | `CHAPTER` | `chapter` | Roman numeral (`I`, `II`, `IV`) | Major grouping, usually by agency |
| `DIV4` | `SUBCHAP` | `subchapter` | Letter (`A`, `B`) | Subdivision of a chapter |
| `DIV5` | `PART` | `part` | Numeric (`1`, `240`) | Primary regulatory unit |
| `DIV6` | `SUBPART` | `subpart` | Letter (`A`, `B`) | Subdivision of a part |
| `DIV7` | `SUBJGRP` | `subpart` | Numeric (`1`-`6`) | Subject group; organizational only, not a legal subdivision |
| `DIV8` | `SECTION` | `section` | `§ N.N` (`§ 1.1`, `§ 240.10b-5`) | Atomic regulatory unit |
| `DIV9` | `APPENDIX` | `appendix` | Text (`Appendix A`) | Part-level appendix |

### Key DIV Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `N` | Display number or label for the division | `"17"`, `"II"`, `"§ 240.10b-5"` |
| `NODE` | Internal GPO hierarchical position ID | `"17:1.0.1.1.1.0.1.1"` |
| `TYPE` | Semantic level type (determines LevelType mapping) | `"TITLE"`, `"SECTION"` |

**Important**: The `NODE` attribute is for internal GPO use and may be changed at any time. It is not a stable identifier. LexBuild uses `NODE` only to recover the title number for multi-volume govinfo files; CFR identifiers are constructed from the normalized `N` value together with the current title number, and `NODE` is never exposed in output.

### Multi-Volume Titles

Large titles (e.g., Title 17) span multiple volumes. In govinfo bulk XML, each volume produces a separate `<DIV1>` element whose `N` attribute is the volume number, not the title number. The builder extracts the title number from the `NODE` attribute prefix (e.g., `NODE="17:1"` yields title number `17`) and then uses that title number, together with normalized `N` values on parts/sections/chapters, to construct CFR identifiers. In ecfr.gov API XML, a single `<DIV1>` represents the entire title with `N` set to the title number directly.

## Section Structure

```xml
<DIV8 N="§ 1.1" NODE="1:1.0.1.1.1.0.1.1" TYPE="SECTION">
  <HEAD>§ 1.1   Definitions.</HEAD>
  <P>(a) <I>Act</I> means the Commodity Exchange Act...</P>
  <P>(b) <I>Commission</I> means the Commodity Futures Trading Commission.</P>
  <CITA TYPE="N">[41 FR 3194, Jan. 21, 1976]</CITA>
</DIV8>
```

**AST**: Maps to `LevelNode` with `levelType: "section"`. The builder strips the `§ N.N` prefix from `<HEAD>` text to extract the heading.

### Flat Paragraph Model

Unlike USLM's nested hierarchy (`<subsection>` > `<paragraph>` > `<clause>`), eCFR uses flat `<P>` elements with numbering prefixes embedded in the text:

```xml
<P>(a) First subsection text...</P>
<P>(1) First paragraph text...</P>
<P>(i) First clause text...</P>
```

The `EcfrASTBuilder` does NOT create nested `LevelNode` structures for these subdivisions. Each `<P>` is treated as a `ContentNode` with its numbering prefix preserved in the text. This reflects the eCFR's flat document model.

## Content Elements

| Element | Description | AST Node |
|---------|-------------|----------|
| `P` | Paragraph, primary content element | `ContentNode` |
| `FP` | Flush paragraph (no indent) | `ContentNode` |
| `FP-1` | Indented flush paragraph (level 1) | `ContentNode` |
| `FP-2` | Indented flush paragraph (level 2) | `ContentNode` |
| `FP-DASH` | Dash-leader flush paragraph (form lines) | `ContentNode` |
| `FP1-2` | Alternative indented paragraph variant | `ContentNode` |
| `FRP` | Flush right paragraph | `ContentNode` |

All content elements map to `ContentNode` with `variant: "content"`. Their visual formatting differences (indentation, alignment) are not preserved in the Markdown output.

### Block Elements

| Element | Description | AST Treatment |
|---------|-------------|---------------|
| `EXTRACT` | Extracted or quoted text block | Block wrapper around content |
| `EXAMPLE` | Illustrative example text | Block wrapper around content |

### Sub-Headings

| Element | Description | Markdown Output |
|---------|-------------|----------------|
| `HD1` | Primary sub-heading within a section or appendix | Bold heading text |
| `HD2` | Secondary sub-heading | Bold heading text |
| `HD3` | Tertiary sub-heading | Bold heading text |

Sub-headings appear within sections and appendices to organize content. They are not hierarchical levels and do not create `LevelNode` entries.

### HEAD Element

`<HEAD>` provides the heading text for DIV elements. In sections, it typically includes the section number prefix (e.g., `§ 1.1   Definitions.`), which the builder strips to extract the heading text separately.

## Inline Elements

### E Element (Emphasis)

The `<E>` element is the primary inline formatting element in eCFR XML. The `T` (type) attribute determines the rendering:

| T Value | InlineType | Markdown | Usage |
|---------|-----------|----------|-------|
| `"01"` | `bold` | `**text**` | General emphasis |
| `"02"` | `italic` | `*text*` | Definitions, terms |
| `"03"` | `bold` | `**text**` | Bold italic in print |
| `"04"` | `italic` | `*text*` | Headings, labels |
| `"05"` | `italic` | `*text*` | Small caps (exhibit labels) |
| `"51"` | `sub` | `<sub>text</sub>` | Subscript |
| `"52"` | `sub` | `<sub>text</sub>` | Subscript |
| `"54"` | `sub` | `<sub>text</sub>` | Subscript (math notation) |
| `"7462"` | `italic` | `*text*` | Special terms (et seq., de minimis) |

When no `T` attribute is present or the value is unrecognized, the default rendering is italic.

### Other Inline Elements

| Element | Description | Markdown |
|---------|-------------|----------|
| `I` | Italic | `*text*` |
| `B` | Bold | `**text**` |
| `SU` | Superscript (also used for footnote markers) | `<sup>text</sup>` |
| `FR` | Fraction | Rendered as text |
| `AC` | Accent / smallcaps | Rendered as uppercase text |

### Cross-Reference Elements

| Element | Description | Attributes |
|---------|-------------|------------|
| `XREF` | Cross-reference link | `ID`, `REFID` |
| `FTREF` | Footnote reference marker | Links to `FTNT` element |

## Note Elements

Notes in eCFR XML provide regulatory metadata, citations, and editorial information. They appear at various levels in the hierarchy.

### Part-Level Notes

These notes appear on `DIV5` (part), not on individual sections.

| Element | noteType | Structure | Description |
|---------|----------|-----------|-------------|
| `AUTH` | `authority` | `<HED>Authority:</HED><PSPACE>text</PSPACE>` | Statutory authority under which the regulation is issued |
| `SOURCE` | `regulatorySource` | `<HED>Source:</HED><PSPACE>text</PSPACE>` | Publication source of the regulation |

The `EcfrASTBuilder` captures `AUTH` and `SOURCE` in a `partNotes` map (keyed by part identifier) during parsing. The converter enriches each section's frontmatter with the `authority` field from its parent part's `AUTH` note.

### Section-Level Notes

| Element | noteType | Description |
|---------|----------|-------------|
| `CITA` | `citation` | Amendment history citation, typically the last element in a section. Direct text content: `[41 FR 3194, Jan. 21, 1976]` |
| `SECAUTH` | `sectionAuthority` | Section-level authority citation. Direct text: `(Sec. 10; 48 Stat. 891; ...)` |
| `APPRO` | `approval` | OMB approval note. Direct text: `(Approved by OMB...)` |

### General Notes

| Element | noteType | Structure | Description |
|---------|----------|-----------|-------------|
| `EDNOTE` | `editorial` | `<HED>Editorial Note:</HED><PSPACE>text</PSPACE>` | Editorial note from GPO |
| `EFFDNOT` | `effectiveDate` | `<HED>Effective Date Note:</HED><PSPACE>text</PSPACE>` | Effective date information |
| `NOTE` | `general` | `<HED>Note:</HED><P>text</P>` | General informational note |
| `CROSSREF` | `crossReference` | `<HED>Cross Reference:</HED><P>text</P>` | Cross-reference to related provisions |

### Footnotes

| Element | noteType | Structure |
|---------|----------|-----------|
| `FTNT` | `footnote` | `<P><SU>1</SU> Footnote text...</P>` |

Footnote markers in the body text use `<SU>` (superscript) elements. The `FTNT` element at the section or part level provides the footnote definition.

## Table Elements

eCFR uses HTML-style table elements, not the GPOTABLE format found in some older GPO publications.

| Element | Description |
|---------|-------------|
| `TABLE` | Table container |
| `TR` | Table row |
| `TH` | Table header cell |
| `TD` | Table data cell |

**AST**: Maps to `TableNode` with `variant: "xhtml"`. Headers and body rows are separated into `headers` and `rows` arrays.

**Markdown**: Rendered as pipe-syntax Markdown tables.

Tables are often wrapped in `<DIV class="gpotbl_div">` (lowercase `div`) containers. These lowercase `div` wrappers are handled as pass-through elements.

## Special Elements

| Element | Description | Treatment |
|---------|-------------|-----------|
| `RESERVED` | Reserved section or part placeholder | Skipped |
| `STARS` | Stars (`* * *`) indicating omitted text | Skipped |
| `GPH` | Graphic reference | Skipped (no image rendering) |
| `MATH` | Mathematical content | Skipped |
| `PRTPAGE` | Printed page marker | Skipped |
| `PG` | Page number | Skipped |
| `AMDDATE` | Amendment date metadata | Skipped |
| `VOLUME` | Volume metadata (ecfr.gov API) | Skipped |

### Element Classification Summary

| Category | Behavior | Elements |
|----------|----------|----------|
| **Ignore** | Skip entire subtree | `CFRTOC`, `HEADER` |
| **Pass-through** | Transparent wrapper, no frame created | `DLPSTEXTCLASS`, `TEXT`, `BODY`, `ECFRBRWS`, `ECFR` |
| **Skip** | Skip self, no subtree suppression | `PTHD`, `CHAPTI`, `SECHD`, `SUBJECT`, `RESERVED`, `PG`, `STARS`, `AMDDATE`, `VOLUME` |

## Identifier Construction

CFR identifiers are constructed by the `EcfrASTBuilder` from `NODE` and `N` attributes during parsing. Identifiers use `/us/cfr/` (content type), not `/us/ecfr/` (data source). Both eCFR and a future annual CFR converter would share the same identifier space.

```
/us/cfr/t{title}                  Title
/us/cfr/t{title}/ch{chapter}      Chapter (Roman numeral converted to Arabic)
/us/cfr/t{title}/pt{part}         Part
/us/cfr/t{title}/s{section}       Section
```

**Examples**:

| Source XML | Constructed Identifier |
|------------|----------------------|
| `DIV1 N="17" TYPE="TITLE"` | `/us/cfr/t17` |
| `DIV3 N="II" TYPE="CHAPTER"` | `/us/cfr/t17/ch2` |
| `DIV5 N="240" TYPE="PART"` | `/us/cfr/t17/pt240` |
| `DIV8 N="§ 240.10b-5" TYPE="SECTION"` | `/us/cfr/t17/s240.10b-5` |

The `§` prefix in section `N` values (present in govinfo bulk XML but not ecfr.gov API XML) is stripped during identifier construction.

## Reserved Titles

Title 35 (Panama Canal) is reserved. Both ecfr.gov API and govinfo return 404 for this title. There are 50 CFR titles total, 49 with content. The downloaders silently skip reserved titles via the `RESERVED_TITLES` set during `--all` downloads.

## Frontmatter Fields

eCFR sections include all standard LexBuild frontmatter fields plus source-specific fields:

| Field | Value | Description |
|-------|-------|-------------|
| `source` | `"ecfr"` | Content source discriminator |
| `legal_status` | `"authoritative_unofficial"` | eCFR is not the official CFR |
| `positive_law` | `false` | Regulations are not legislation |
| `authority` | *(from part AUTH)* | Statutory authority citation |
| `regulatory_source` | *(from part SOURCE)* | Publication source citation |
| `cfr_part` | *(part number)* | CFR part number (e.g., `"240"`) |
| `cfr_subpart` | *(subpart identifier)* | Subpart identifier when applicable |
| `agency` | *(agency name)* | Responsible agency name |
