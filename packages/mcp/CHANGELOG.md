# @lexbuild/mcp

## 2.0.0

### Major Changes

- ac2d6f1: Rename CFR API source identifier from `"cfr"` to `"ecfr"` across all MCP tools, prompts, and client methods to match the Data API endpoint rename from `/api/cfr/` to `/api/ecfr/`. The `ApiSource` type, tool/prompt Zod schemas, and URI parser now use `"ecfr"`. Canonical document identifiers remain in the `/us/cfr/` namespace.

## 1.23.3

## 1.22.0

### Minor Changes

- Add @lexbuild/mcp package — Model Context Protocol server for LexBuild
