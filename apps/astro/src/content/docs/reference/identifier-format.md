---
title: Identifier Format
description: Specification for the canonical URI identifiers used across all LexBuild sources, including USC, CFR, and FR identifier schemes, level prefixes, link resolution priority, and fallback URL generation.
order: 3
---

LexBuild assigns every piece of legal content a canonical URI identifier. These identifiers appear in YAML frontmatter, `_meta.json` sidecar files, and cross-reference links throughout the output. They are stable, deterministic, and shared across all LexBuild tools. This page is the definitive reference for the identifier format and how cross-references are resolved.

## Identifier Schemes

LexBuild uses three identifier schemes, one for each source type. All identifiers begin with `/us/` (jurisdiction) followed by a code designating the source.

### USC Identifiers

USC identifiers come directly from the `identifier` attribute on USLM XML elements published by the Office of the Law Revision Counsel (OLRC). The format uses path segments with prefixed level codes:

```
/us/usc/t{title}/s{section}/{subsection}/{paragraph}
```

For example, `/us/usc/t1/s201/a/2` breaks down as:

| Segment | Meaning |
|---------|---------|
| `/us` | Jurisdiction (United States) |
| `/usc` | Code (United States Code) |
| `/t1` | Title 1 |
| `/s201` | Section 201 |
| `/a` | Subsection (a) |
| `/2` | Paragraph (2) |

Big levels (title through section) use a prefix letter to indicate their level:

| Prefix | Level |
|--------|-------|
| `t` | Title |
| `st` | Subtitle |
| `ch` | Chapter |
| `sch` | Subchapter |
| `art` | Article |
| `p` | Part |
| `sp` | Subpart |
| `d` | Division |
| `sd` | Subdivision |
| `s` | Section |

Small levels (subsection and below) use their value directly without a prefix: `/us/usc/t1/s1/a`, `/us/usc/t1/s1/a/2/A/i`.

#### USC Identifier Examples

| Identifier | Description |
|------------|-------------|
| `/us/usc/t1` | Title 1 |
| `/us/usc/t1/ch1` | Chapter 1 of Title 1 |
| `/us/usc/t26/sch1` | Subchapter 1 of Title 26 |
| `/us/usc/t1/s1` | Section 1 of Title 1 |
| `/us/usc/t1/s1/a` | Subsection (a) of Section 1 of Title 1 |
| `/us/usc/t1/s1/a/2/A/i` | Clause (i) of subparagraph (A) of paragraph (2) of subsection (a) |

### CFR Identifiers

CFR identifiers are constructed by the eCFR builder from `NODE` and `N` attributes in the GPO/SGML XML. The format mirrors the USC scheme:

```
/us/cfr/t{title}/s{section}
```

Identifiers use `/us/cfr/` (content type), not `/us/ecfr/` (data source). Both eCFR and future annual CFR share the same identifier space since they represent the same regulatory content.

#### CFR Identifier Examples

| Identifier | Description |
|------------|-------------|
| `/us/cfr/t17` | Title 17 |
| `/us/cfr/t17/ch2` | Chapter II of Title 17 (Roman numeral converted to Arabic) |
| `/us/cfr/t17/pt240` | Part 240 of Title 17 |
| `/us/cfr/t17/s240.10b-5` | Section 240.10b-5 of Title 17 |

Note that CFR chapter identifiers convert Roman numerals to Arabic numbers (e.g., Chapter II becomes `ch2`).

#### CFR Identifier Construction

The eCFR builder constructs identifiers from XML attributes during parsing:

| Source XML | Constructed Identifier |
|------------|----------------------|
| `DIV1 N="17" TYPE="TITLE"` | `/us/cfr/t17` |
| `DIV3 N="II" TYPE="CHAPTER"` | `/us/cfr/t17/ch2` |
| `DIV5 N="240" TYPE="PART"` | `/us/cfr/t17/pt240` |
| `DIV8 N="§ 240.10b-5" TYPE="SECTION"` | `/us/cfr/t17/s240.10b-5` |

The `§` prefix in section `N` values (present in govinfo bulk XML but not ecfr.gov API XML) is stripped during identifier construction.

### FR Identifiers

FR identifiers use document numbers from the FederalRegister.gov API. Document numbers are unique, stable, and serve as the API's primary key:

```
/us/fr/{document_number}
```

#### FR Identifier Examples

| Identifier | Description |
|------------|-------------|
| `/us/fr/2026-06029` | FR document 2026-06029 |
| `/us/fr/2026-06086` | FR document 2026-06086 |

FR identifiers use document numbers rather than FR citations (e.g., `91 FR 14523`) because citations are human-readable but not reliably unique.

## Non-Resolvable References

Some identifier schemes found in cross-references within USLM XML cannot be resolved to files or URLs. These are always rendered as plain text:

| URI Prefix | Treatment |
|------------|-----------|
| `/us/stat/...` | Plain text citation (Statutes at Large) |
| `/us/pl/...` | Plain text citation (Public Laws) |
| `/us/act/...` | Plain text citation (Acts) |

When the link resolver encounters one of these prefixes, it returns `null`, signaling the renderer to output the reference text without a link.

## Link Resolution

When you convert with `--link-style relative`, LexBuild resolves cross-references embedded in the source XML into Markdown links. The resolver uses a three-tier priority chain.

### Resolution Priority

1. **Exact match** -- The identifier is found in the link registry. This always works for same-title references and for cross-title references when the target title has already been converted. Returns a relative file path.

2. **Section-level fallback** -- If the exact identifier is not registered (common for subsection-level references like `/us/usc/t1/s1/a/2`), the resolver strips the subsection path and tries the parent section identifier (`/us/usc/t1/s1`). If found, returns a relative path to the section file.

3. **External URL fallback** -- If neither exact nor section-level lookup succeeds, the resolver generates a fallback URL for USC and FR identifiers, or returns `null` for all other identifier types.

### Fallback URLs

When a cross-reference cannot be resolved within the converted corpus, the resolver produces external URLs for supported schemes:

| Identifier Scheme | Fallback URL Pattern |
|-------------------|---------------------|
| `/us/usc/t{N}/s{N}` | `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title{N}-section{N}` |
| `/us/usc/t{N}` | `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title{N}` |
| `/us/fr/{doc_number}` | `https://www.federalregister.gov/d/{doc_number}` |

Unresolved CFR references (`/us/cfr/`) are rendered as plain text. No automatic ecfr.gov fallback URLs are generated. Statutes at Large (`/us/stat/`) and Public Law (`/us/pl/`) references are always rendered as plain text.

## Link Styles

The `--link-style` option controls how cross-references render in the output Markdown:

| Style | Output | Use Case |
|-------|--------|----------|
| `plaintext` (default) | Reference text only, no link | RAG pipelines where links add noise |
| `relative` | `[text](../chapter-03/section-201.md)` | Local browsing, documentation sites |
| `canonical` | `[text](https://uscode.house.gov/...)` | External publication, standalone documents |

### Relative Link Paths

In `relative` mode, the resolver computes paths relative to the current file:

| Reference Type | Example Link |
|----------------|-------------|
| Same chapter | `section-7.md` |
| Cross-chapter | `../chapter-03/section-201.md` |
| Cross-title | `../../title-02/chapter-05/section-100.md` |

### Canonical Mode

In `canonical` mode, all resolvable USC references link to OLRC URLs regardless of whether the target has been converted locally. Non-USC/CFR references render as plain text.

## Two-Pass Requirement

Link resolution requires that all section identifiers and output paths are known before rendering begins. Both forward references (section A cites section B, which appears later in the title) and backward references must resolve correctly.

This is why LexBuild uses a collect-then-write pattern:

1. **Parse phase** -- SAX events fire synchronously, collecting all sections into an array.
2. **Write phase, pass 1** -- Compute output paths, detect duplicates, register all identifiers with the link resolver.
3. **Write phase, pass 2** -- Render Markdown and write files. All cross-references can now resolve.
