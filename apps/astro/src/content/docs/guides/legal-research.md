---
title: "Legal Research"
description: "Use LexBuild to cross-reference statutes, regulations, and Federal Register documents for legal research and regulatory analysis."
order: 2
---

# Legal Research

LexBuild gives you structured access to three primary sources of U.S. federal law. Understanding how they connect is the key to effective legal research.

## The Three Sources

### U.S. Code (USC)

The U.S. Code is the official compilation of federal statutes. Congress passes laws, and the Office of the Law Revision Counsel (OLRC) organizes them into 54 subject-matter titles.

- **Identifier pattern:** `/us/usc/t{title}/s{section}` (e.g., `/us/usc/t17/s107`)
- **Contains:** Statutes currently in force, organized by subject
- **Updated:** When the OLRC publishes new release points (typically after each session of Congress)

### Code of Federal Regulations (CFR via eCFR)

The CFR contains regulations written by federal agencies to implement the statutes in the U.S. Code. LexBuild uses the electronic Code of Federal Regulations (eCFR) as its source, which is updated daily.

- **Identifier pattern:** `/us/cfr/t{title}/s{section}` (e.g., `/us/cfr/t17/s240.10b-5`)
- **Contains:** Agency regulations currently in force, organized into 50 titles
- **Updated:** Daily on eCFR; LexBuild supports point-in-time snapshots via `--date`

### Federal Register (FR)

The Federal Register is the daily journal of the U.S. government. Agencies publish proposed rules, final rules, notices, and presidential documents here before they take effect in the CFR.

- **Identifier pattern:** `/us/fr/{document_number}` (e.g., `/us/fr/2026-06029`)
- **Contains:** Proposed rules, final rules, notices, presidential documents
- **Updated:** Every business day

## How the Sources Connect

The three sources form a regulatory lifecycle:

```
Congress passes a law (USC)
    → Agency writes regulations to implement it (CFR)
        → Agency publishes rulemaking actions in the Federal Register (FR)
            → Final rules amend the CFR
```

For example:

1. **Statute:** The Securities Exchange Act of 1934 is codified at 15 USC Chapter 2B (Title 15, sections 78a-78qq).
2. **Regulation:** The SEC implements it through regulations in 17 CFR Part 240, including the well-known Rule 10b-5 (anti-fraud provision).
3. **Rulemaking:** When the SEC amends Rule 10b-5, it publishes a proposed rule and a final rule in the Federal Register, each referencing 17 CFR 240.10b-5.

## Cross-Referencing Between Sources

### Frontmatter Fields for Cross-Referencing

Each source includes frontmatter fields that point to related documents in other sources:

| Field | Source | Points To |
|---|---|---|
| `authority` | eCFR | USC statute authorizing the regulation |
| `source_credit` | USC | Public law citations (Statutes at Large) |
| `cfr_references` | FR | CFR titles and parts amended by the FR document |
| `agencies` | FR | Agencies responsible for the rulemaking |
| `effective_date` | FR | When the rule takes effect in the CFR |

### Example: Tracing a Regulation

Start with a Federal Register final rule and trace it through the system:

**1. Find the FR document:**

```bash
# Search for recent SEC final rules
curl "https://lexbuild.dev/api/fr/documents?agencies=Securities+and+Exchange+Commission&document_type=rule&limit=5"
```

Or browse at [lexbuild.dev/fr](https://lexbuild.dev/fr) and filter by date.

**2. Check what it amends:**

Look at the `cfr_references` field in the FR document's frontmatter:

```yaml
cfr_references:
  - "17 CFR Part 240"
  - "17 CFR Part 249"
```

This tells you the rule amends regulations in 17 CFR Parts 240 and 249.

**3. Find the CFR section:**

```bash
# Get the specific CFR section
curl -H "Accept: text/markdown" \
  "https://lexbuild.dev/api/ecfr/documents/t17/s240.10b-5"
```

**4. Find the statutory authority:**

The eCFR section's `authority` frontmatter field cites the enabling statute:

```yaml
authority: "15 U.S.C. 78a et seq."
```

This points to Title 15 of the U.S. Code, starting at section 78a.

**5. Read the statute:**

```bash
curl -H "Accept: text/markdown" \
  "https://lexbuild.dev/api/usc/documents/t15/s78a"
```

## Identifier Patterns

LexBuild uses canonical URI identifiers for every document. Understanding the pattern helps when constructing queries and cross-references.

### USC Identifiers

```
/us/usc/t{title}/s{section}
```

Level prefixes for structural elements above section:

| Prefix | Level | Example |
|---|---|---|
| `t` | Title | `/us/usc/t42` |
| `ch` | Chapter | `/us/usc/t42/ch7` |
| `sch` | Subchapter | `/us/usc/t42/ch7/schXVIII` |
| `s` | Section | `/us/usc/t42/s1395` |

### CFR Identifiers

```
/us/cfr/t{title}/s{section}
```

CFR section numbers often include part prefixes (e.g., `240.10b-5` means Part 240, Section 10b-5).

### FR Identifiers

```
/us/fr/{document_number}
```

Document numbers are assigned by the Office of the Federal Register (e.g., `2026-06029`).

## Using Search

Search across all three sources simultaneously on the web at [lexbuild.dev](https://lexbuild.dev) using the search bar (Cmd+K / Ctrl+K), or query the API:

```bash
# Search across all sources
curl "https://lexbuild.dev/api/search?q=securities+fraud&limit=20"

# Filter to a specific source
curl "https://lexbuild.dev/api/search?q=securities+fraud&source=ecfr&limit=20"
```

Search results include the `source` field, so you can see which results are statutes (USC), regulations (eCFR), or Federal Register documents (FR).

## Working with Amendment History

### USC Editorial Notes

USC sections often include editorial notes that document amendment history. These appear at the end of the Markdown body:

```markdown
#### Amendments

**2020** -- Pub. L. 116-283, div. H, title XCVI, Sec. 9601(a)(1),
added par. (3).

**2018** -- Subsec. (a). Pub. L. 115-232, Sec. 801(a), substituted
"section 7013" for "section 3013".
```

These notes are included by default. To exclude them:

```bash
lexbuild convert-usc --all --no-include-notes
```

Or include only specific note types:

```bash
lexbuild convert-usc --all --include-editorial-notes --no-include-statutory-notes
```

### eCFR Authority Citations

Every eCFR part lists its statutory authority, which tells you the legal basis for the regulation:

```yaml
authority: "15 U.S.C. 78a et seq., 78c, 78d, 78j, 78l, 78m, 78n, 78o"
```

This is a direct link back to the U.S. Code sections that authorize the agency to write these regulations.

## Bulk Analysis

For large-scale research across the full corpus, download everything locally and use standard text tools:

```bash
# Download and convert all sources
lexbuild download-usc --all && lexbuild convert-usc --all
lexbuild download-ecfr --all && lexbuild convert-ecfr --all
lexbuild download-fr --from 2000-01-01 && lexbuild convert-fr --all

# Find all sections referencing "securities fraud"
rg "securities fraud" output/ --glob "*.md" -l

# Find all CFR sections citing a specific USC section
rg "15 U.S.C. 78j" output/ecfr/ --glob "*.md" -l

# Find FR documents amending a specific CFR part
rg "cfr_references:.*17 CFR Part 240" output/fr/ --glob "*.md" -l

# Count sections per title
for dir in output/usc/sections/title-*/; do
  title=$(basename "$dir")
  count=$(find "$dir" -name "section-*.md" | wc -l)
  echo "$title: $count sections"
done
```

Since every file is standalone Markdown with YAML frontmatter, you can also import the corpus into databases, spreadsheets, or any tool that reads text files.

## Next Steps

- [Bulk Download](/docs/guides/bulk-download) -- Download the full corpus for local research
- [RAG Pipeline Integration](/docs/guides/rag-pipeline) -- Feed LexBuild output into AI systems
- [Identifier Format](/docs/reference/identifier-format) -- Full identifier specification
- [Output Format](/docs/cli/output-format) -- Frontmatter schema and file structure reference
