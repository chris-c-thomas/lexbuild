---
title: "Introduction to LexBuild"
description: "Overview of LexBuild, available interfaces, and supported legal sources."
order: 1
---

# Introduction to LexBuild

LexBuild is a toolchain that converts U.S. legal source data into structured Markdown optimized for AI ingestion, retrieval-augmented generation (RAG) systems, semantic search, and legal research.

## Core Interfaces

LexBuild provides four primary methods for accessing and processing legal content:

* **CLI:** A command-line tool to download and convert legal XML sources locally, outputting standalone Markdown files with structured YAML frontmatter.
* **API:** A REST API for programmatic access to legal content, supporting content negotiation for JSON, Markdown, and plaintext responses.
* **MCP Server (Coming Soon):** A Model Context Protocol server that directly connects local or cloud-hosted LLM agents to the LexBuild knowledge graph for real-time legal context retrieval.
* **Web:** A browser-based interface to navigate, search, and read the U.S. Code, Code of Federal Regulations, and Federal Register as rendered Markdown at [lexbuild.dev](https://lexbuild.dev).

## Supported Sources

| Source | Description | Coverage |
|---|---|---|
| U.S. Code | Federal statutory law | 54 titles, ~60k sections |
| eCFR | Electronic Code of Federal Regulations | 50 titles, ~200k sections |
| Federal Register | Daily regulatory publications | 2000-present, 770k+ documents |

## Documentation Overview

This documentation is structured to support different integration paths:

* **Getting Started:** Quickstarts for the CLI, API, Web, and MCP server.
* **CLI Reference:** Installation, commands, source-specific workflows, and output format specifications.
* **API Reference:** Authentication, endpoints, content negotiation, and pagination details.
* **MCP Server (Coming Soon):** Configuration, capabilities, and agentic workflow patterns.
* **Web Interface:** Browsing, advanced search, and content extraction.
* **Guides:** Implementation strategies for RAG pipelines, bulk downloading, and legal research.
* **Architecture:** Internal mechanics of the XML-to-Markdown conversion pipeline.
* **Reference:** Comprehensive specifications for identifiers, metadata schemas, and XML element mappings.

> [!TIP]
> To evaluate the conversion output immediately, start with the [CLI Quickstart](/docs/getting-started/quickstart-cli).
