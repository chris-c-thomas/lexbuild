---
applyTo: "packages/mcp/**/*.ts"
---

# MCP Instructions

These instructions apply to the LexBuild MCP server in `packages/mcp/`.

- Read `packages/mcp/CLAUDE.md` before changing transports, tools, resources, prompts, or configuration.
- Preserve the package role: `@lexbuild/mcp` is a thin typed adapter over the LexBuild Data API.
- Keep package boundaries strict:
  - do not add direct SQLite access
  - do not add XML parsing or converter logic
  - do not add dependencies on `@lexbuild/core`, `@lexbuild/usc`, `@lexbuild/ecfr`, `@lexbuild/fr`, or `@lexbuild/cli`
- The public surface consists of tools, resources, prompts, and transports. Prefer extending those existing registration paths rather than adding parallel wiring.
- Keep both current transports working:
  - stdio for local/client installs
  - Streamable HTTP for hosted use
- Stdio transport must not write protocol output-contaminating logs to stdout. Preserve the existing logging discipline.
- Treat response size and safety limits as part of the contract:
  - keep response-budget enforcement intact
  - preserve injection-defense and SSRF-protection behavior
  - preserve rate limiting and configuration validation
- When adding or changing a tool, resource, or prompt, keep naming, schemas, and descriptions aligned with the package README and the server registration flow.
- Prefer API-client and schema changes over ad hoc fetch logic scattered across tools.
- Keep environment-driven configuration Zod-validated and centralized.
- If a change affects the hosted HTTP transport, ensure it still fits the current Hono-based transport setup rather than introducing a separate server model.
