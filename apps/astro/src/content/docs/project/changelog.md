---
title: "Changelog"
description: "Recent changes and release history for LexBuild."
order: 2
---

# Changelog

LexBuild follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) formatting and [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages. All published packages use lockstep versioning via [Changesets](https://github.com/changesets/changesets).

For the complete changelog, see [CHANGELOG.md on GitHub](https://github.com/chris-c-thomas/LexBuild/blob/main/CHANGELOG.md).

## Recent Releases

### 1.17.2

- Added **Data API** (`apps/api/`) -- Hono-based REST API serving U.S. legal content from SQLite with Meilisearch search proxy
- Document retrieval endpoints for USC, CFR, and FR with content negotiation (JSON/Markdown/plaintext), field selection, and ETag caching
- Paginated collection listings with multi-field filtering, sorting, and cursor-based pagination
- Hierarchy browsing endpoints for USC/CFR titles and FR years/months
- Full-text search with faceted filtering and result highlighting
- API key authentication with tiered rate limiting
- CLI commands: `lexbuild api-key create|list|revoke|update`
- OpenAPI 3.1 spec with Scalar API reference UI

### 1.17.0

- Docker-based Meilisearch search index deployment (`--search-docker`) -- indexes locally, transfers pre-built data to VPS
- Incremental source indexing (`--search-docker --source fr`)
- Docker volume seeding from VPS (`--search-docker-seed`)
- FR content support in the search pipeline

### 1.16.0

- `enrich-fr` CLI command -- fetches metadata from the FederalRegister.gov API and patches YAML frontmatter
- Per-source search index checkpoints replacing global checkpoint
- FR FrontmatterPanel displays Action and CFR References fields

### 1.15.2

- Fixed sidebar collapse bug where USC/eCFR titles could not be collapsed after auto-expand
- Fixed sidebar error handling to show "Failed to load" with retry instead of empty state
- Updated homepage sample output and CLI Quick Start
- Added planned packages (PLAW, Bills, Municipal Code) to homepage

### 1.15.0

- **Federal Register** (`@lexbuild/fr`) -- new source package for FR XML conversion
- `download-fr` and `convert-fr` CLI commands with govinfo bulk and API downloaders
- Date-based browsing at `/fr/{YYYY}/{MM}/{document_number}`
- FR sidebar with year/month navigation tree
- FR-specific FrontmatterPanel fields (agencies, docket IDs, CFR references)
- Search index expanded to include FR documents (~770k documents)

### 1.14.0

- **eCFR** (`@lexbuild/ecfr`) -- source package for Code of Federal Regulations
- `download-ecfr` and `convert-ecfr` CLI commands
- eCFR browsing at `/ecfr/` with title/chapter/part/section hierarchy
- Part-level granularity output (`-g part`)

### 1.13.0

- Full-text search powered by Meilisearch
- `SearchDialog` component with Cmd+K shortcut
- Meilisearch indexing scripts for batch and incremental updates
