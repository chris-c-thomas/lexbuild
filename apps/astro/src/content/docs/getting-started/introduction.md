---
title: "Introduction to LexBuild"
description: "What LexBuild is, the three product surfaces, and what sources are available."
order: 1
---

# Introduction to LexBuild

LexBuild converts U.S. legal source data into structured Markdown for AI/RAG ingestion, semantic search, and legal research.

## Three Product Surfaces

LexBuild provides three ways to access structured legal content:

1. **CLI** -- Download and convert legal XML sources locally. Produces standalone Markdown files with YAML frontmatter metadata.
2. **Web** -- Browse the U.S. Code, Code of Federal Regulations, and Federal Register as rendered Markdown at [lexbuild.dev](https://lexbuild.dev).
3. **API** -- Programmatic access to legal content via a REST API with JSON, Markdown, and plaintext response formats.

## Supported Sources

| Source | Description | Coverage |
|---|---|---|
| U.S. Code | Federal statutory law | 54 titles, ~60k sections |
| eCFR | Electronic Code of Federal Regulations | 50 titles, ~200k sections |
| Federal Register | Daily regulatory publications | 2000-present, 770k+ documents |

## What You'll Learn

This documentation covers:

- **Getting Started** -- Quick introductions to each product surface
- **CLI** -- Installation, commands, source-specific workflows, output format
- **Web** -- Browsing, searching, and downloading content
- **API** -- Authentication, endpoints, content negotiation, pagination
- **Guides** -- Practical guides for RAG pipelines, legal research, and bulk downloads
- **Architecture** -- How the conversion pipeline works under the hood
- **Reference** -- Complete specifications for CLI flags, output format, identifiers, and XML element mappings

> [!TIP]
> If you just want to try LexBuild, start with the [CLI Quickstart](/docs/getting-started/quickstart-cli).
