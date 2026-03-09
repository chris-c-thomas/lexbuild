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

Deep-dive documentation for each published package.

- [@lexbuild/core](packages/core.md) — Format-agnostic XML parsing, AST, and rendering infrastructure
- [@lexbuild/usc](packages/usc.md) — U.S. Code conversion and OLRC downloader
- [@lexbuild/cli](packages/cli.md) — CLI binary and command registration

## Apps

Applications that consume LexBuild output.

- [Web App](apps/web.md) — Next.js documentation site for browsing converted output

## Reference

Specifications and lookup tables.

- [Output Format](reference/output-format.md) — Directory layout, frontmatter schema, metadata indexes, RAG guidance
- [XML Element Reference](reference/xml-element-reference.md) — USLM element mapping and Markdown output
- [CLI Reference](reference/cli-reference.md) — Complete command and option reference
- [Glossary](reference/glossary.md) — Legal and technical terms used throughout this project
