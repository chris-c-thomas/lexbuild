---
title: "U.S. Code"
description: "Download and convert the United States Code to structured Markdown using the LexBuild CLI."
order: 3
---

# U.S. Code

The United States Code (USC) is the official compilation of federal statutory law, organized into 54 subject-matter titles. LexBuild downloads USC XML from the Office of the Law Revision Counsel (OLRC) and converts it into structured Markdown files.

## Download

Download USC XML files with `download-usc`. The command fetches XML from the OLRC download server.

Download all 54 titles:

```bash
lexbuild download-usc --all
```

Download specific titles:

```bash
lexbuild download-usc --titles 1
lexbuild download-usc --titles 1-5,8,11
```

Files are saved to `./downloads/usc/xml/` by default (e.g., `usc01.xml`, `usc26.xml`). Use `-o` to change the download directory:

```bash
lexbuild download-usc --all -o ./my-downloads
```

### Release Points

The OLRC publishes the U.S. Code at specific release points that correspond to when new public laws are incorporated. By default, `download-usc` auto-detects the latest release point from the OLRC website.

List available release points:

```bash
lexbuild list-release-points
lexbuild list-release-points -n 5    # Show only the 5 most recent
lexbuild list-release-points -n 0    # Show all available
```

Pin a specific release point:

```bash
lexbuild download-usc --all --release-point 119-73not60
```

## Convert

Convert downloaded XML files to Markdown with `convert-usc`.

Convert all downloaded titles:

```bash
lexbuild convert-usc --all
```

Convert specific titles:

```bash
lexbuild convert-usc --titles 1
lexbuild convert-usc --titles 1-5,8,11
```

Convert a single XML file by path:

```bash
lexbuild convert-usc ./downloads/usc/xml/usc01.xml
```

### Granularity

Control the output file size with the `-g` flag:

| Level | Description | Example Output |
|---|---|---|
| `section` (default) | One `.md` file per section | `title-01/chapter-01/section-1.md` |
| `chapter` | One `.md` file per chapter, sections inlined | `title-01/chapter-01.md` |
| `title` | One `.md` file per title, entire hierarchy inlined | `title-01.md` |

```bash
lexbuild convert-usc --all -g chapter
lexbuild convert-usc --titles 26 -g title
```

### Notes Filtering

All notes (editorial, statutory, and amendment history) are included by default. Disable them entirely or filter selectively:

```bash
# Exclude all notes
lexbuild convert-usc --all --no-include-notes

# Include only editorial notes
lexbuild convert-usc --all --include-editorial-notes

# Include only statutory notes and amendments
lexbuild convert-usc --all --include-statutory-notes --include-amendments
```

### Dry Run

Preview what would be converted without writing any files:

```bash
lexbuild convert-usc --all --dry-run
```

This parses all XML and reports section counts, chapter counts, and token estimates.

## Output Structure

At the default `section` granularity, output follows this directory structure:

```
output/usc/
  title-01/
    README.md
    _meta.json
    chapter-01/
      README.md
      _meta.json
      section-1.md
      section-2.md
      section-3.md
    chapter-02/
      ...
  title-02/
    ...
```

Each directory contains:

- **`_meta.json`** -- a sidecar index listing all children with identifiers and titles
- **`README.md`** -- a human-readable summary of that level

At `chapter` granularity, the chapter directories are replaced with single chapter files. At `title` granularity, each title is a flat `title-NN.md` file with no subdirectories.

## Further Reading

- [Output Format](/docs/cli/output-format) -- Frontmatter schema and Markdown structure
- [Configuration](/docs/cli/configuration) -- Link styles, output directories, and other options
- [CLI Reference](/docs/reference/cli-reference) -- Complete flag tables for all USC commands
