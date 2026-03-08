# LexBuild Documentation

This directory contains the full documentation for LexBuild — an open-source toolchain for converting legislative source data into structured Markdown optimized for LLMs, RAG pipelines, and semantic search.

## Architecture

How LexBuild is designed and built.

- [Overview](architecture/overview.md) — System architecture and the three-layer design
- [Conversion Pipeline](architecture/conversion-pipeline.md) — XML-to-Markdown data flow and the section-emit pattern
- [AST Model](architecture/ast-model.md) — Intermediate representation and node types
- [Monorepo Structure](architecture/monorepo-structure.md) — Directory layout and workspace conventions
- [Dependency Graph](architecture/dependency-graph.md) — Package relationships and how new sources plug in
- [Build Pipeline](architecture/build-pipeline.md) — Turborepo orchestration and build order
- [CI/CD](architecture/ci-cd.md) — GitHub Actions workflows for testing and publishing
- [Link Resolution](architecture/link-resolution.md) — Cross-reference resolution strategy
- [Performance](architecture/performance.md) — Benchmarks, memory profile, and streaming design
- [Future Sources](architecture/future-sources.md) — Roadmap for CFR, state statutes, and beyond

## Development

Getting started as a contributor.

- [Getting Started](development/getting-started.md) — Prerequisites, setup, and first build
- [Testing](development/testing.md) — Test framework, fixtures, snapshots, and conventions
- [Release Process](development/release-process.md) — Changesets, versioning, and npm publishing
- [Extending LexBuild](development/extending.md) — Adding new legal source packages
- [Coding Standards](development/coding-standards.md) — TypeScript conventions, naming, and error handling
- [Debugging](development/debugging.md) — Common issues, XML debugging, and memory profiling

## Packages

Deep-dive documentation for each package and app.

- [@lexbuild/core](packages/core.md) — Format-agnostic XML parsing, AST, and rendering infrastructure
- [@lexbuild/usc](packages/usc.md) — U.S. Code conversion and OLRC downloader
- [@lexbuild/cli](packages/cli.md) — CLI binary and command registration
- [Web App](packages/web.md) — Next.js documentation site for browsing converted output

## Reference

Specifications and lookup tables.

- [Output Format](reference/output-format.md) — Directory layout, frontmatter schema, metadata indexes, RAG guidance
- [XML Element Reference](reference/xml-element-reference.md) — USLM element mapping and Markdown output
- [CLI Reference](reference/cli-reference.md) — Complete command and option reference
- [Glossary](reference/glossary.md) — Legal and technical terms used throughout this project

## Architecture Decision Records

Key design decisions and their rationale.

- [ADR-0001: Monorepo](adr/0001-monorepo.md) — pnpm workspaces + Turborepo
- [ADR-0002: SAX over DOM](adr/0002-sax-over-dom.md) — Streaming parser for bounded memory
- [ADR-0003: Section as Atomic Unit](adr/0003-section-as-atomic-unit.md) — One file per section
- [ADR-0004: Lockstep Versioning](adr/0004-lockstep-versioning.md) — All packages share a version
- [ADR-0005: Output Format](adr/0005-output-format.md) — Markdown + YAML frontmatter + JSON sidecars
