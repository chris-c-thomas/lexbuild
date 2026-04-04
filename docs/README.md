# LexBuild Documentation

LexBuild is an open-source platform that converts U.S. legal XML into structured Markdown optimized for AI ingestion, RAG pipelines, and semantic search. It currently processes three major federal legal corpora — the U.S. Code (54 titles, ~60,000 sections), the electronic Code of Federal Regulations (49 titles, ~227,000 sections), and the Federal Register (~30,000 documents/year) — producing structured Markdown files with YAML frontmatter and JSON sidecar indexes. Additional sources are planned.

The project is organized as a TypeScript monorepo with five published npm packages, a server-rendered web application, and a REST API.

## Architecture

- [Overview](architecture/overview.md)
- [Conversion Pipeline](architecture/conversion-pipeline.md)
- [AST Model](architecture/ast-model.md)
- [Monorepo Structure](architecture/monorepo-structure.md)
- [Build Pipeline](architecture/build-pipeline.md)
- [Link Resolution](architecture/link-resolution.md)
- [Performance](architecture/performance.md)

## Packages

- [@lexbuild/core](packages/core.md)
- [@lexbuild/cli](packages/cli.md)
- [@lexbuild/usc](packages/usc.md)
- [@lexbuild/ecfr](packages/ecfr.md)
- [@lexbuild/fr](packages/fr.md)

## Apps

- [@lexbuild/astro](apps/astro.md)
- [@lexbuild/api](apps/api.md)

## Development

- [Getting Started](development/getting-started.md)
- [Testing](development/testing.md)
- [Coding Standards](development/coding-standards.md)
- [Extending LexBuild](development/extending.md)
- [Debugging](development/debugging.md)
- [CI/CD](development/ci-cd.md)
- [Release Process](development/release-process.md)

## Reference

- [CLI Reference](reference/cli-reference.md)
- [Output Format Specification](reference/output-format.md)
- [USLM Element Reference](reference/uslm-element-reference.md)
- [eCFR Element Reference](reference/ecfr-element-reference.md)
- [FR Element Reference](reference/fr-element-reference.md)
- [Glossary](reference/glossary.md)
