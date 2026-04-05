---
title: Glossary
description: Definitions for legal, technical, and LexBuild-specific terms used throughout the documentation, covering U.S. legal publishing terminology and the LexBuild conversion pipeline.
order: 7
---

This glossary defines terms you will encounter throughout the LexBuild documentation. It covers U.S. legal publishing terminology (positive law, chapeau, codification), technical terms from the XML and conversion pipeline (SAX, AST, frontmatter), and LexBuild-specific concepts (collect-then-write, emit-at-level, source package). If you are new to U.S. legal data or LexBuild's architecture, start here.

## Legal Terms

**Authority citation** -- The statutory authority under which a federal regulation is issued. Appears as an `AUTH` note at the part level in eCFR XML. Included in section frontmatter as the `authority` field.

**CFR (Code of Federal Regulations)** -- The codification of the general and permanent rules published by federal agencies, organized by subject into 50 titles. Updated annually in print; the eCFR provides a continuously updated electronic version.

**Chapeau** -- Introductory text that precedes a list of sub-levels within a section. For example: "The following terms have the meanings given in this section--". Represented in USLM XML as a `<chapeau>` element and in the AST as a `ContentNode` with `variant: "chapeau"`.

**Chapter** -- A major subdivision of a title. In the U.S. Code, chapters are numbered with Arabic numerals. In the CFR, chapters are designated by Roman numerals identifying the responsible agency (e.g., Chapter II = Securities and Exchange Commission).

**Clause** -- A subdivision below subparagraph in the U.S. Code hierarchy, numbered with lowercase Roman numerals: (i), (ii), (iii). Subclauses use uppercase Roman numerals: (I), (II), (III).

**Codification** -- The process of arranging laws or regulations by subject matter into a systematic code. The U.S. Code is a codification of federal statutes; the CFR is a codification of federal regulations.

**Continuation** -- Text that appears after or between sub-levels within a section. Unlike chapeau (which always precedes), continuation text can appear interstitially between elements at the same level. Represented as `<continuation>` in USLM XML.

**eCFR (Electronic Code of Federal Regulations)** -- A daily-updated, unofficial version of the Code of Federal Regulations published at ecfr.gov by the National Archives. While authoritative, it is not the official legal text -- the annual printed CFR and the Federal Register together constitute the official version.

**Federal Register** -- The daily journal of the U.S. federal government, publishing proposed rules, final rules, executive orders, and notices. New and amended regulations appear first in the Federal Register before being codified in the CFR.

**Paragraph** -- A subdivision below subsection in the U.S. Code hierarchy, numbered with Arabic numerals: (1), (2), (3). In eCFR XML, the term "paragraph" refers to flat `<P>` content elements, not hierarchical subdivisions.

**Part** -- In the CFR, the primary organizational unit containing related regulatory sections. Parts are numbered (e.g., Part 240) and grouped under chapters. Each part typically covers a distinct area of regulation.

**Positive law** -- A title of the U.S. Code that has been enacted as a statute by Congress. Positive law titles constitute legal evidence of the law; their text is the law itself. As of the current release point, 29 of 54 titles are positive law.

**Prima facie evidence** -- Evidence that is accepted as correct unless disproved. Non-positive-law U.S. Code titles have this status: their text is presumed to accurately reflect the underlying statutes, but the Statutes at Large control in case of conflict.

**Proviso** -- A conditional clause within a legal provision, typically beginning "Provided that..." or "Provided, That...". Represented as `<proviso>` in USLM XML and in the AST as a `ContentNode` with `variant: "proviso"`.

**Public law** -- A law enacted by Congress and signed by the President (or passed over a veto), identified by Congress number and sequential law number. Example: Pub. L. 119-73 is the 73rd public law of the 119th Congress.

**Release point** -- An OLRC-defined point identifying which public laws have been incorporated into the U.S. Code XML. Expressed as a Congress-law pair, sometimes with exclusions. Example: `119-73not60` means "through Public Law 119-73, excluding Public Law 119-60."

**Repealed** -- A section or provision that has been expressly removed from the Code by subsequent legislation. Repealed sections may still appear in the XML with `status="repealed"` and a note explaining the repeal.

**Reserved** -- A section, part, or title number that is held for future use and contains no current content. In the U.S. Code, individual sections can be reserved. In the CFR, Title 35 (Panama Canal) is entirely reserved.

**Section** -- The primary independently citable unit of law in both the U.S. Code and the CFR. In the U.S. Code, sections are designated with the section sign: § 1, § 7801. In the CFR, sections are prefixed with their part number: § 240.10b-5.

**Source credit** -- The parenthetical citation at the end of a U.S. Code section identifying the statutory source(s) from which it was derived. Example: `(July 30, 1947, ch. 388, 61 Stat. 633.)`. Represented as `<sourceCredit>` in USLM XML.

**Statutes at Large** -- The permanent collection of all laws enacted by Congress, organized chronologically by session. Referenced by volume and page number (e.g., 61 Stat. 633). For non-positive-law titles, the Statutes at Large are the authoritative legal text.

**Subchapter** -- A subdivision of a chapter, used in both the U.S. Code (e.g., Subchapter I, II) and the CFR (e.g., Subchapter A, B). In eCFR XML, represented as `DIV4` with `TYPE="SUBCHAP"`.

**Subparagraph** -- A subdivision below paragraph in the U.S. Code hierarchy, numbered with uppercase letters: (A), (B), (C).

**Subsection** -- A subdivision below section in the U.S. Code hierarchy, numbered with lowercase letters: (a), (b), (c). This is the first level of subdivision within a section.

**Transferred** -- A section that has been moved to a different location in the Code, typically as part of a reorganization or recodification. The original location may contain a cross-reference note directing readers to the new location.

## Technical Terms

**AST (Abstract Syntax Tree)** -- LexBuild's intermediate representation between source XML and Markdown output. A typed tree of nodes (`LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `TableNode`, etc.) that captures the semantic structure of legal text. The AST is source-agnostic: different builders produce the same node types from different XML formats.

**Dublin Core** -- A metadata standard (ISO 15836) used in USLM XML for document-level metadata such as title, creator, publisher, and creation date. Elements appear in the `<meta>` block with `dc:` and `dcterms:` namespace prefixes.

**Emit-at-level** -- The streaming pattern used by AST builders. When the closing tag of a configured level (section, chapter, or title) is processed, the completed subtree is emitted via callback and released from memory. This keeps memory bounded when processing large XML files (100 MB+).

**FORMAT_VERSION** -- The version of LexBuild's output format, currently `1.1.0`. Included in YAML frontmatter and `_meta.json` files. Consumers can use this value to detect format changes across LexBuild releases.

**Frontmatter** -- A YAML metadata block at the beginning of each Markdown file, delimited by `---` markers. Contains structured fields (identifier, title, source, legal status, section number, etc.) that enable file-level RAG ingestion without parsing the Markdown body.

**GPO (Government Publishing Office)** -- The U.S. government agency that publishes federal documents including the Federal Register, Code of Federal Regulations, and U.S. Code. GPO provides bulk XML data for the CFR through govinfo.gov.

**Granularity** -- The hierarchical level at which LexBuild produces output files. For the U.S. Code: section (default), chapter, or title. For the eCFR: section (default), part, chapter, or title. Finer granularity produces more files with smaller token counts; coarser granularity produces fewer, larger files.

**Namespace** -- An XML mechanism for distinguishing elements from different schemas that share element names. USLM XML uses five namespaces: the default USLM namespace, XHTML (for tables), Dublin Core, DC Terms, and XML Schema Instance. eCFR XML uses no namespaces.

**OLRC (Office of the Law Revision Counsel)** -- The office of the U.S. House of Representatives responsible for maintaining and publishing the United States Code. Publishes USLM XML files at uscode.house.gov.

**SAX (Simple API for XML)** -- An event-driven XML parsing model. The parser reads the document as a stream, emitting events (open element, close element, text) rather than building a complete in-memory tree. LexBuild uses SAX (via the `saxes` library) to process XML files that can exceed 100 MB without exhausting memory.

**Sidecar** -- A companion metadata file (`_meta.json`) generated alongside Markdown content files. Provides a structured index of sections within a directory (chapter or part), including identifiers, headings, section numbers, token estimates, and file paths. Enables index-based retrieval without parsing individual Markdown files.

**USLM (United States Legislative Markup)** -- The XML schema (version 1.0, patch level 1.0.15) developed by the OLRC for encoding U.S. Code documents. Defines elements for hierarchical legal structure, cross-references, notes, tables, and metadata. Namespace URI: `http://xml.house.gov/schemas/uslm/1.0`.

## LexBuild-Specific Terms

**Collect-then-write** -- The synchronous collection pattern used during SAX parsing. Emitted AST nodes are collected into an array during the streaming parse phase. All file I/O (rendering and writing) happens after parsing completes. This avoids async backpressure issues in SAX event handlers and enables two-pass operations like duplicate detection and link resolution.

**Converter** -- The orchestrator function in each source package that runs the full pipeline: parse XML, collect AST nodes, resolve cross-references, render Markdown, write output files, and generate sidecar metadata. Examples: `convertTitle()` in `@lexbuild/usc`, `convertEcfrTitle()` in `@lexbuild/ecfr`.

**Core** -- Shorthand for `@lexbuild/core`, the format-agnostic foundation package. Provides XML parsing, AST type definitions, Markdown rendering, frontmatter generation, link resolution, and resilient file I/O utilities. All source packages depend on core.

**Downloader** -- A function that fetches bulk XML data from official government sources. `@lexbuild/usc` downloads from the OLRC (uscode.house.gov). `@lexbuild/ecfr` downloads from ecfr.gov (default, daily-updated) or govinfo.gov (fallback, irregularly updated).

**EcfrASTBuilder** -- The source-specific AST builder for eCFR GPO/SGML XML. Consumes SAX events and produces `LevelNode` trees using the same emit-at-level pattern as the USLM builder but dispatching on eCFR element names (`DIV1`-`DIV9`, `HEAD`, `P`, etc.). Located in `@lexbuild/ecfr`.

**Legal status** -- A frontmatter field indicating the legal authority of the source content. One of three values:
- `"official_legal_evidence"` -- positive law U.S. Code titles (the text IS the law)
- `"official_prima_facie"` -- non-positive-law U.S. Code titles (presumed correct, Statutes at Large control)
- `"authoritative_unofficial"` -- eCFR and FR content (authoritative but not the official version)

**Link resolver** -- The system that converts cross-reference identifier URIs (e.g., `/us/usc/t26/s7801`) to Markdown links or fallback URLs. Identifiers are registered during the collection phase so that both forward and backward cross-references resolve correctly. Unresolved USC references fall back to OLRC website URLs; unresolved CFR references are rendered as plain text.

**Section-emit pattern** -- The default operating mode where the AST builder emits one completed section at a time. Each section's subtree is released from memory after emission, keeping peak memory proportional to the largest single section rather than the full title.

**Source package** -- A package that handles conversion for a specific legal XML format. Source packages depend on `@lexbuild/core` for shared infrastructure but are independent of each other. Current source packages: `@lexbuild/usc` (U.S. Code), `@lexbuild/ecfr` (eCFR), and `@lexbuild/fr` (Federal Register).

**Source type** -- The `source` discriminator field in frontmatter, indicating which source package produced the output. Current values: `"usc"`, `"ecfr"`, and `"fr"`. Consumers can use this field to determine which source-specific frontmatter fields to expect.
