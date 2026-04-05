---
title: "eCFR"
description: "Download and convert the Electronic Code of Federal Regulations to structured Markdown using the LexBuild CLI."
order: 4
---

# eCFR

The Electronic Code of Federal Regulations (eCFR) is the daily-updated version of the Code of Federal Regulations (CFR), published by the Government Publishing Office. It contains the general and permanent rules established by federal agencies, organized into 50 subject-matter titles.

> [!NOTE]
> Title 35 (Panama Canal) is reserved and contains no content. It is automatically skipped during download and conversion.

## Download

Download eCFR XML files with `download-ecfr`. Two download sources are available.

### eCFR API (Default)

The eCFR API at ecfr.gov provides daily-updated XML. This is the recommended source.

```bash
lexbuild download-ecfr --all
lexbuild download-ecfr --titles 1
lexbuild download-ecfr --titles 1-5,17
```

Download a point-in-time snapshot by specifying a date:

```bash
lexbuild download-ecfr --all --date 2026-01-01
```

The `--date` flag retrieves regulations as they existed on that date.

### govinfo (Bulk Data)

The govinfo source provides bulk XML from govinfo.gov. This data may lag behind the eCFR API by days or weeks.

```bash
lexbuild download-ecfr --all --source govinfo
```

### Download Options

Files are saved to `./downloads/ecfr/xml/` by default (e.g., `ECFR-title1.xml`, `ECFR-title17.xml`). Use `-o` to change the download directory:

```bash
lexbuild download-ecfr --all -o ./my-downloads
```

## Convert

Convert downloaded XML files to Markdown with `convert-ecfr`.

Convert all downloaded titles:

```bash
lexbuild convert-ecfr --all
```

Convert specific titles:

```bash
lexbuild convert-ecfr --titles 1
lexbuild convert-ecfr --titles 1-5,17
```

Convert a single XML file by path:

```bash
lexbuild convert-ecfr ./downloads/ecfr/xml/ECFR-title1.xml
```

### Granularity

The eCFR converter supports four granularity levels. The additional `part` level reflects the CFR's part-based organizational structure.

| Level | Description | Example Output |
|---|---|---|
| `section` (default) | One `.md` file per section | `title-01/chapter-I/part-1/section-1.1.md` |
| `part` | One `.md` file per part, sections inlined | `title-01/chapter-I/part-1.md` |
| `chapter` | One `.md` file per chapter, parts and sections inlined | `title-01/chapter-I.md` |
| `title` | One `.md` file per title, entire hierarchy inlined | `title-01.md` |

```bash
lexbuild convert-ecfr --all -g part
lexbuild convert-ecfr --titles 17 -g title
```

### Notes Filtering

Notes filtering works the same as for the U.S. Code:

```bash
lexbuild convert-ecfr --all --no-include-notes
lexbuild convert-ecfr --all --include-editorial-notes
```

### Dry Run

```bash
lexbuild convert-ecfr --all --dry-run
```

## Output Structure

At the default `section` granularity, output follows this directory structure:

```
output/ecfr/
  title-01/
    README.md
    _meta.json
    chapter-I/
      README.md
      _meta.json
      part-1/
        README.md
        _meta.json
        section-1.1.md
        section-1.2.md
      part-2/
        ...
  title-17/
    chapter-II/
      part-240/
        section-240.10b-5.md
        ...
```

Note that eCFR chapter numbers use Roman numerals (e.g., `chapter-I`, `chapter-IV`) while part and section numbers are Arabic. Section numbers can include dots and letters (e.g., `240.10b-5`).

## Further Reading

- [Output Format](/docs/cli/output-format) -- Frontmatter schema and Markdown structure
- [Configuration](/docs/cli/configuration) -- Link styles, output directories, and other options
- [CLI Reference](/docs/reference/cli-reference) -- Complete flag tables for all eCFR commands
