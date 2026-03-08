# Documentation Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure LexBuild documentation from a flat `docs/old/` directory into a well-organized hierarchy with architecture, development, package, reference, and ADR sections, plus new root-level files.

**Architecture:** Move from 4 files in `docs/old/` to ~33 files across `docs/` subdirectories and root-level additions. Content is sourced from existing `docs/old/` files, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, and package-level docs. All documentation should be written in a forward-looking tone that reflects LexBuild as a platform for multiple legal sources, not just the U.S. Code.

**Tech Stack:** Markdown files only. No build tools, no generated docs.

---

## Content Sources

Existing content to draw from (do NOT copy verbatim — restructure, expand, and improve):

| Source | Content | Target |
|--------|---------|--------|
| `docs/old/architecture.md` (431 lines) | System overview, dependency graph, data flow, AST types, memory profile, future architecture | Splits across `docs/architecture/` |
| `docs/old/extending.md` (216 lines) | Adding new source packages, CFR/state notes, integration patterns | `docs/development/extending.md` |
| `docs/old/output-format.md` (383 lines) | Directory layout, frontmatter schema, `_meta.json`, RAG guidance | `docs/reference/output-format.md` |
| `docs/old/xml-element-reference.md` (220 lines) | USLM element mapping to Markdown | `docs/reference/xml-element-reference.md` |
| `CLAUDE.md` | Deep architectural detail, conventions, pitfalls, USLM schema reference | Informs many docs |
| `CONTRIBUTING.md` | Setup, workflow, conventions, testing, PRs | Informs `docs/development/` |
| `README.md` | Overview, features, CLI reference, performance, install | Informs overview + reference docs |
| Package `README.md` + `CLAUDE.md` files | Package-specific architecture and API | `docs/packages/` |
| `.github/workflows/ci.yml` | CI pipeline (Node 20/22, pnpm, build/lint/typecheck/test) | `docs/architecture/ci-cd.md` |
| `.github/workflows/publish.yml` | Changesets action, npm publish | `docs/development/release-process.md` |

## Writing Guidelines

- **Forward-looking tone**: Write as if multiple source packages already exist or are imminent. Use phrases like "source packages (currently `usc`)" rather than "the USC package."
- **Cross-link liberally**: Every doc should link to related docs within the `docs/` hierarchy.
- **No duplication**: If content exists in `README.md` or `CONTRIBUTING.md`, reference it rather than duplicating it. Exception: docs that provide deeper treatment of a topic can expand on what the root-level file summarizes.
- **Consistent structure**: Each doc starts with a one-paragraph summary, then dives into specifics.
- **Code examples**: Use real code from the codebase, not made-up examples. Reference actual file paths.

---

## Task 1: Create Directory Structure

**Files:**
- Create: `docs/README.md` (placeholder initially)
- Create: `docs/architecture/` directory
- Create: `docs/development/` directory
- Create: `docs/packages/` directory
- Create: `docs/reference/` directory
- Create: `docs/adr/` directory

**Step 1: Create all directories**

```bash
mkdir -p docs/{architecture,development,packages,reference,adr}
```

**Step 2: Write `docs/README.md`**

The docs index/landing page. Lists all sections with brief descriptions and links. Serves as the entry point for anyone browsing the docs directory. Structure:

```markdown
# LexBuild Documentation

Brief intro paragraph.

## Sections

### [Architecture](architecture/)
- [Overview](architecture/overview.md)
- [Monorepo Structure](architecture/monorepo-structure.md)
- ... (all 10 files)

### [Development](development/)
- [Getting Started](development/getting-started.md)
- ... (all 6 files)

### [Packages](packages/)
- ... (all 4 files)

### [Reference](reference/)
- ... (all 4 files)

### [Architecture Decision Records](adr/)
- ... (all 5 files)
```

**Step 3: Commit**

```bash
git add docs/README.md
git commit -m "docs: add documentation directory structure and index"
```

---

## Task 2: Architecture Docs — Core Pipeline

Create the first batch of architecture docs covering the system overview, conversion pipeline, and AST model.

**Files:**
- Create: `docs/architecture/overview.md`
- Create: `docs/architecture/conversion-pipeline.md`
- Create: `docs/architecture/ast-model.md`

**Content guidance:**

### `overview.md`

High-level system overview. Source from `docs/old/architecture.md` lines 1-48 (system overview + ASCII diagram) and expand:

- What LexBuild is and what problem it solves (platform for converting legal source data to structured Markdown)
- The three-layer architecture: core infrastructure, source packages, CLI/apps
- ASCII system diagram (adapt from existing)
- Link to deeper docs for each component

### `conversion-pipeline.md`

The XML-to-Markdown data flow. Source from `docs/old/architecture.md` lines 317-398 (data flow + memory profile):

- End-to-end pipeline diagram (SAX → AST Builder → Renderer → Writer)
- Section-emit pattern explanation
- Memory profile table
- How each granularity mode (section, chapter, title) changes the pipeline
- How new source packages plug into the same pipeline

### `ast-model.md`

AST node types and semantics. Source from `docs/old/architecture.md` lines 95-142 (AST types):

- Purpose of the intermediate AST (semantic representation, not 1:1 XML mapping)
- All node types with TypeScript interfaces: `LevelNode`, `ContentNode`, `InlineNode`, `NoteNode`, `SourceCreditNode`, `TableNode`, `TOCNode`, `QuotedContentNode`
- How source packages produce AST nodes and the renderer consumes them
- Diagram: XML elements → AST nodes → Markdown output

**Step: Commit**

```bash
git add docs/architecture/overview.md docs/architecture/conversion-pipeline.md docs/architecture/ast-model.md
git commit -m "docs: add architecture overview, conversion pipeline, and AST model"
```

---

## Task 3: Architecture Docs — Structure and Build

Create docs covering the monorepo layout, dependency graph, and build pipeline.

**Files:**
- Create: `docs/architecture/monorepo-structure.md`
- Create: `docs/architecture/dependency-graph.md`
- Create: `docs/architecture/build-pipeline.md`

**Content guidance:**

### `monorepo-structure.md`

Source from `docs/old/architecture.md` lines 37-66 + `README.md` monorepo section:

- Directory tree with descriptions (packages/, apps/, fixtures/, docs/)
- Package-layer vs app-layer distinction
- Workspace protocol (`workspace:*`)
- How new packages fit into the structure
- What lives at root vs in packages

### `dependency-graph.md`

Source from `docs/old/architecture.md` lines 39-48:

- ASCII dependency tree (current state + future projection)
- Rule: source packages depend on core, CLI depends on all source packages
- Source packages are independent of each other
- How this enables parallel development of new sources

### `build-pipeline.md`

Source from `docs/old/architecture.md` lines 50-58 + Turborepo config:

- Turborepo dependency-aware build order
- `turbo.json` pipeline configuration
- Build, test, lint, typecheck task relationships
- How `tsup` bundles each package
- Dev mode (watch + rebuild)

**Step: Commit**

```bash
git add docs/architecture/monorepo-structure.md docs/architecture/dependency-graph.md docs/architecture/build-pipeline.md
git commit -m "docs: add monorepo structure, dependency graph, and build pipeline docs"
```

---

## Task 4: Architecture Docs — CI/CD, Links, Performance, Future

Complete the architecture section.

**Files:**
- Create: `docs/architecture/ci-cd.md`
- Create: `docs/architecture/link-resolution.md`
- Create: `docs/architecture/performance.md`
- Create: `docs/architecture/future-sources.md`

**Content guidance:**

### `ci-cd.md`

Source from `.github/workflows/ci.yml` and `.github/workflows/publish.yml`:

- CI pipeline: triggers (push to main, PRs), matrix (Node 20 + 22), steps (install, build, lint, typecheck, test)
- Publish pipeline: changesets/action, npm publish, release PR flow
- Concurrency settings
- What the CI checks guarantee

### `link-resolution.md`

Source from `docs/old/architecture.md` lines 373-397 (cross-reference resolution):

- USLM identifier URI format and parsing
- Single-pass registration strategy
- Resolution priority (same title → other converted titles → OLRC fallback)
- How this extends to cross-source linking in the future

### `performance.md`

Source from `README.md` performance section + `docs/old/architecture.md` memory profile:

- Benchmark table (all 54 titles)
- Memory profile breakdown (SAX buffer, AST stack, section AST, etc.)
- Why SAX streaming enables bounded memory
- Performance characteristics by granularity mode

### `future-sources.md`

Source from `docs/old/architecture.md` lines 400-431 + `docs/old/extending.md` lines 112-148:

- Vision: LexBuild as a platform for multiple legal corpora
- Potential source types table (CFR, Federal Register, state statutes)
- What core provides to all sources
- How the monorepo scales horizontally
- CFR-specific notes (USLM 2.x differences, hierarchy, bulk data URLs)
- State statute challenges (heterogeneous formats)

**Step: Commit**

```bash
git add docs/architecture/ci-cd.md docs/architecture/link-resolution.md docs/architecture/performance.md docs/architecture/future-sources.md
git commit -m "docs: add CI/CD, link resolution, performance, and future sources docs"
```

---

## Task 5: Development Docs — Getting Started and Testing

**Files:**
- Create: `docs/development/getting-started.md`
- Create: `docs/development/testing.md`

**Content guidance:**

### `getting-started.md`

Source from `CONTRIBUTING.md` setup section + `README.md` development section. This is the "new contributor" guide:

- Prerequisites (Node >= 20, pnpm >= 10)
- Clone, install, build
- Verify setup (run tests, lint, typecheck)
- Common commands cheat sheet
- Running the CLI locally during development
- Project structure orientation (which package does what)
- Link to `coding-standards.md` for conventions

### `testing.md`

Source from `CONTRIBUTING.md` testing section, significantly expanded:

- Testing framework (vitest)
- Co-located test files convention
- Test naming guidelines with examples
- Snapshot tests: purpose, location (`fixtures/expected/`), how to update
- Test fixtures: `fixtures/fragments/` (synthetic XML), `fixtures/expected/` (snapshots)
- Running tests (all, filtered by package, single file)
- Writing tests for new element handlers
- Integration test patterns (XML input → expected Markdown output)

**Step: Commit**

```bash
git add docs/development/getting-started.md docs/development/testing.md
git commit -m "docs: add getting started and testing guides"
```

---

## Task 6: Development Docs — Release, Extending, Standards, Debugging

**Files:**
- Create: `docs/development/release-process.md`
- Create: `docs/development/extending.md`
- Create: `docs/development/coding-standards.md`
- Create: `docs/development/debugging.md`

**Content guidance:**

### `release-process.md`

Source from `CONTRIBUTING.md` changesets section + `.github/workflows/publish.yml`:

- Changesets workflow: create changeset → commit → merge → release PR → publish
- Lockstep versioning: all packages bump together
- The publish pipeline (GitHub Action: changesets/action)
- Version bump types (patch/minor/major) and when to use each
- How `workspace:*` protocol resolves during publish

### `extending.md`

Source from `docs/old/extending.md`, restructured and updated:

- Current architecture (element handling in ASTBuilder)
- Step-by-step guide: create package, implement converter, add downloader, register CLI command, add tests, write docs
- What core provides (reusable infrastructure)
- Adding an application (apps/ directory pattern)
- Integration patterns (direct file consumption, programmatic, pipeline)

### `coding-standards.md`

Source from `CONTRIBUTING.md` conventions + `CLAUDE.md` code conventions:

- TypeScript: strict mode, ESM, `import type`, `interface` over `type`, `unknown` over `any`
- Naming: files (kebab-case), types (PascalCase), functions (camelCase), constants (UPPER_SNAKE_CASE)
- Error handling: XML errors warn-and-continue, I/O errors throw with context
- Formatting: Prettier config (double quotes, trailing commas, 100 char width)
- JSDoc: required on all exported functions and types

### `debugging.md`

New content (not sourced from existing docs):

- Common issues and solutions (build order, workspace resolution, type errors from stale builds)
- Debugging XML parsing (enabling verbose SAX output, isolating problematic elements)
- Debugging test failures (snapshot mismatches, fixture creation)
- Memory profiling for large titles
- Useful development flags (`--verbose`, `--dry-run`)

**Step: Commit**

```bash
git add docs/development/release-process.md docs/development/extending.md docs/development/coding-standards.md docs/development/debugging.md
git commit -m "docs: add release process, extending, coding standards, and debugging guides"
```

---

## Task 7: Package Docs

Deep-dive documentation for each package and app. These complement the package-level `README.md` files (which stay focused on quick-start/API) by providing architectural depth.

**Files:**
- Create: `docs/packages/core.md`
- Create: `docs/packages/usc.md`
- Create: `docs/packages/cli.md`
- Create: `docs/packages/web.md`

**Content guidance:**

### `core.md`

Source from `packages/core/README.md` + `packages/core/CLAUDE.md` + `docs/old/architecture.md` core section:

- Package purpose: format-agnostic foundation shared by all source packages
- Module structure: `src/xml/`, `src/ast/`, `src/markdown/`
- XML Parser: `saxes` wrapper, namespace normalization, typed events, `parseString`/`parseStream`
- AST Builder: stack-based construction, section-emit pattern, `EmitContext`
- Markdown Renderer: stateless, pure, `RenderOptions`, notes filtering
- Frontmatter Generator: `FrontmatterData` interface, `FORMAT_VERSION`, `GENERATOR`
- Link Resolver: `LinkResolver` interface, registration, resolution, fallback
- Namespace classification: USLM default, XHTML, Dublin Core

### `usc.md`

Source from `packages/usc/README.md` + `packages/usc/CLAUDE.md`:

- Package purpose: U.S. Code-specific conversion (USLM 1.0)
- Converter: `convertTitle()` orchestration, `ConvertOptions`, `ConvertResult`
- Downloader: OLRC bulk data, release points, ZIP extraction
- Collect-then-write pattern: why async operations can't run during SAX events
- Granularity modes and how they affect `emitAt` and output structure
- Edge cases: duplicate sections, appendix titles, anomalous nesting, quoted content suppression
- USLM schema notes relevant to this package

### `cli.md`

Source from `packages/cli/README.md` + `packages/cli/CLAUDE.md`:

- Package purpose: thin orchestration layer, published as `@lexbuild/cli`
- Command structure: `download`, `convert` (future: per-source commands)
- UI module: `chalk`, `ora`, `cli-table3` for user-facing output
- Title parser: how `--titles 1-5,8,11` is parsed
- Build configuration: `tsup` with `commander` as external
- Error handling: user-facing error messages vs internal errors
- How new source commands are registered

### `web.md`

Source from `apps/web/README.md` + `apps/web/CLAUDE.md`:

- App purpose: browse the entire U.S. Code as structured Markdown
- Architecture: Next.js 16 SSR, content provider abstraction, CDN caching
- Content pipeline: `generate-content.sh` → content/ + nav/ + search/ + sitemap
- Key routes: `/usc/title-[num]`, `/usc/title-[num]/chapter-[num]`, `/usc/title-[num]/chapter-[num]/section-[num]`
- No code dependency on `@lexbuild/*` packages
- Deployment: Vercel via local CLI, `.vercelignore` overrides

**Step: Commit**

```bash
git add docs/packages/core.md docs/packages/usc.md docs/packages/cli.md docs/packages/web.md
git commit -m "docs: add deep-dive package documentation"
```

---

## Task 8: Reference Docs

Authoritative reference material for downstream consumers and developers.

**Files:**
- Create: `docs/reference/output-format.md`
- Create: `docs/reference/xml-element-reference.md`
- Create: `docs/reference/cli-reference.md`
- Create: `docs/reference/glossary.md`

**Content guidance:**

### `output-format.md`

Source from `docs/old/output-format.md` — this is largely a migration with light updates:

- Versioning (`FORMAT_VERSION`)
- Directory layout for all three granularity modes
- Naming conventions table
- Frontmatter schema (section-level and title-level)
- Content structure (heading, chapeau, subsections, source credit, notes)
- Inline hierarchy formatting
- Notes rendering
- Cross-reference links
- Tables (simple Markdown vs fenced HTML)
- `_meta.json` schema (title-level and chapter-level indexes)
- Token estimation methodology
- RAG integration guidance (chunking, metadata for vector stores, stable IDs)

### `xml-element-reference.md`

Source from `docs/old/xml-element-reference.md` — migration with light updates:

- Document root elements
- Metadata elements
- Hierarchical levels ("big levels")
- Primary level (section)
- Small levels (subsection through subsubitem)
- Content elements
- Inline elements
- Reference elements
- Note elements
- Table elements (XHTML + USLM layout)
- TOC elements
- Quoted content
- Special elements
- Universal attributes

### `cli-reference.md`

Source from `README.md` CLI reference section, expanded into a standalone reference:

- `lexbuild download` — all options with descriptions, defaults, examples
- `lexbuild convert` — all options with descriptions, defaults, examples
- Granularity modes table
- Notes filtering behavior (additive flags)
- Exit codes
- Environment variables (if any)
- Examples organized by use case

### `glossary.md`

New content — defines legal and technical terms used throughout the documentation:

- **Legal terms**: U.S. Code, title, chapter, section, subsection, paragraph, subparagraph, clause, chapeau, proviso, positive law, prima facie evidence, Statutes at Large, public law, source credit, codification
- **Technical terms**: USLM, OLRC, SAX, AST, frontmatter, sidecar file, granularity, release point, section-emit pattern, collect-then-write, namespace, Dublin Core
- **LexBuild-specific**: source package, core, converter, downloader, link resolver, emit level

**Step: Commit**

```bash
git add docs/reference/output-format.md docs/reference/xml-element-reference.md docs/reference/cli-reference.md docs/reference/glossary.md
git commit -m "docs: add reference documentation (output format, XML elements, CLI, glossary)"
```

---

## Task 9: Architecture Decision Records (ADRs)

Document the key architectural decisions that shaped LexBuild. Use the standard ADR format: Title, Status, Context, Decision, Consequences.

**Files:**
- Create: `docs/adr/0001-monorepo.md`
- Create: `docs/adr/0002-sax-over-dom.md`
- Create: `docs/adr/0003-section-as-atomic-unit.md`
- Create: `docs/adr/0004-lockstep-versioning.md`
- Create: `docs/adr/0005-output-format.md`

**Content guidance:**

All ADRs follow this template:

```markdown
# ADR-NNNN: Title

**Status:** Accepted
**Date:** 2024-XX-XX (approximate date of decision)

## Context
What is the issue or problem that led to this decision?

## Decision
What was decided and why?

## Consequences
What are the positive and negative outcomes of this decision?
```

### `0001-monorepo.md`

- Context: Need to share code between source packages while keeping them independent
- Decision: pnpm workspaces + Turborepo monorepo
- Consequences: unified CI, shared tooling, but more complex initial setup

### `0002-sax-over-dom.md`

- Context: USC XML files range from 0.3MB to 107MB. DOM parsing would require holding entire tree in memory.
- Decision: SAX streaming parser (`saxes`) with stack-based AST construction
- Consequences: bounded memory (< 10MB per title at section granularity), but more complex code than DOM traversal

### `0003-section-as-atomic-unit.md`

- Context: Need a consistent unit of output that maps to legal citation and fits RAG chunk windows
- Decision: Section is the atomic unit — one file per section in default mode
- Consequences: 60K+ files for full USC, but each file is self-contained and citation-addressable

### `0004-lockstep-versioning.md`

- Context: Multiple interdependent packages that consumers use together
- Decision: All packages versioned in lockstep using changesets
- Consequences: simpler dependency management for consumers, but every release bumps all packages even if unchanged

### `0005-output-format.md`

- Context: Need an output format that works for RAG/LLM ingestion, search indexing, and human reading
- Decision: Markdown with YAML frontmatter + JSON sidecar indexes
- Consequences: universal compatibility (every tool reads Markdown), but complex tables and formatting require HTML fallback

**Step: Commit**

```bash
git add docs/adr/
git commit -m "docs: add architecture decision records (ADRs)"
```

---

## Task 10: Root-Level Files

Add new root-level documentation files.

**Files:**
- Create: `ARCHITECTURE.md`
- Create: `SECURITY.md`

**Content guidance:**

### `ARCHITECTURE.md`

A brief pointer document (not a full architecture doc — that lives in `docs/architecture/`):

- 2-3 paragraph high-level summary of LexBuild's architecture
- ASCII system diagram (same as in `docs/architecture/overview.md`)
- Links to the full architecture docs in `docs/architecture/`
- This follows the common pattern of having `ARCHITECTURE.md` at root as an entry point

### `SECURITY.md`

Standard security policy:

- Supported versions (current major release)
- How to report vulnerabilities (email or GitHub security advisories)
- What constitutes a security issue in LexBuild's context (this is a CLI tool that processes XML, so attack surface is limited)
- Response timeline expectations

**Step: Commit**

```bash
git add ARCHITECTURE.md SECURITY.md
git commit -m "docs: add root-level ARCHITECTURE.md and SECURITY.md"
```

### Note on `AGENTS.md` and `GEMINI.md`

These are omitted from this plan. `CLAUDE.md` already serves as the AI-agent instruction file for Claude. If Gemini or other AI-specific instruction files are needed in the future, they can be added as a separate task. The `docs/` restructure focuses on human-readable project documentation.

If you want `AGENTS.md` and/or `GEMINI.md` included, let me know and I'll add tasks for them.

---

## Task 11: Update Cross-References and Cleanup

**Files:**
- Modify: `README.md` — update Documentation section links
- Modify: `CONTRIBUTING.md` — add links to new development docs
- Modify: `docs/README.md` — finalize with all actual file links
- Delete: `docs/old/` directory (after verifying all content has been migrated)

**Step 1: Update `README.md` Documentation section**

Replace the current documentation table (which points to `docs/architecture.md`, `docs/output-format.md`, etc.) with links to the new structure:

```markdown
## Documentation

| Section | Description |
|---------|-------------|
| [Architecture](docs/architecture/) | System overview, pipeline, AST model, monorepo, CI/CD |
| [Development](docs/development/) | Getting started, testing, release process, extending |
| [Packages](docs/packages/) | Deep-dive docs for core, usc, cli, and web |
| [Reference](docs/reference/) | Output format, XML elements, CLI reference, glossary |
| [ADRs](docs/adr/) | Architecture decision records |
```

**Step 2: Update `CONTRIBUTING.md`**

Add a "Further Reading" section at the bottom linking to:
- `docs/development/getting-started.md`
- `docs/development/coding-standards.md`
- `docs/development/testing.md`
- `docs/development/release-process.md`

**Step 3: Finalize `docs/README.md`**

Ensure all links point to actual created files and descriptions are accurate.

**Step 4: Remove `docs/old/`**

```bash
rm -rf docs/old/
```

Only after confirming all content from the old docs has been incorporated into the new structure.

**Step 5: Commit**

```bash
git add README.md CONTRIBUTING.md docs/README.md
git rm -r docs/old/
git commit -m "docs: update cross-references and remove old docs directory"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | 1 new + dirs | Directory structure + `docs/README.md` index |
| 2 | 3 new | Architecture: overview, conversion pipeline, AST model |
| 3 | 3 new | Architecture: monorepo, dependency graph, build pipeline |
| 4 | 4 new | Architecture: CI/CD, link resolution, performance, future sources |
| 5 | 2 new | Development: getting started, testing |
| 6 | 4 new | Development: release process, extending, coding standards, debugging |
| 7 | 4 new | Package docs: core, usc, cli, web |
| 8 | 4 new | Reference: output format, XML elements, CLI reference, glossary |
| 9 | 5 new | ADRs (5 decision records) |
| 10 | 2 new | Root-level: ARCHITECTURE.md, SECURITY.md |
| 11 | 3 modified + 4 deleted | Update cross-references, remove `docs/old/` |

**Total: ~32 new files, 3 modified, 4 deleted (docs/old/)**
