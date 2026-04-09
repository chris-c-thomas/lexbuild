---
title: "MCP Server"
description: "Model Context Protocol server for LexBuild, giving AI assistants direct access to U.S. legal sources."
order: 1
---

# MCP Server

The LexBuild MCP server gives AI assistants direct access to the U.S. Code, Code of Federal Regulations, and Federal Register through the [Model Context Protocol](https://modelcontextprotocol.io/). Your AI assistant can search, retrieve, and cite over one million legal documents without leaving the conversation.

## Quick Install

Add LexBuild to any MCP-compatible client with a single command:

```bash
npx @lexbuild/mcp
```

Or configure it in your client's MCP settings:

```json
{
  "mcpServers": {
    "lexbuild": {
      "command": "npx",
      "args": ["-y", "@lexbuild/mcp"]
    }
  }
}
```

See [Installation](/docs/mcp/installation) for client-specific setup guides.

## What It Provides

### Tools

Five read-only tools for searching and retrieving legal content:

| Tool | Description |
|---|---|
| `search_laws` | Full-text search across USC, CFR, and Federal Register |
| `get_section` | Fetch a single legal section by canonical identifier |
| `list_titles` | List available titles (USC/CFR) or years (FR) |
| `get_title` | Get title detail with chapters, or year detail with months |
| `get_federal_register_document` | Fetch a Federal Register document by document number |

### Resources

URI-addressable legal sections via the `lexbuild://` scheme:

- `lexbuild://us/usc/t{title}/s{section}` -- U.S. Code section
- `lexbuild://us/cfr/t{title}/s{section}` -- CFR section
- `lexbuild://us/fr/{document_number}` -- Federal Register document

### Prompts

Two pre-built prompt templates:

| Prompt | Description |
|---|---|
| `cite_statute` | Generate a Bluebook citation for a USC or CFR section |
| `summarize_section` | Plain-language summary with audience targeting |

## Transports

The MCP server supports two transports:

- **Stdio** (local) -- Runs on your machine via `npx @lexbuild/mcp`. Used by Claude Desktop, Claude Code, Cursor, and other local MCP clients. This is the default.
- **Streamable HTTP** (hosted) -- Available at `mcp.lexbuild.dev`. No installation required. Useful for remote or web-based clients.

Both transports connect to the [LexBuild Data API](/docs/api/overview) to fetch content. No local database is needed.

## Hosted Endpoint

A hosted MCP server is available at `mcp.lexbuild.dev` using the Streamable HTTP transport. No API key is required for basic usage. The hosted endpoint is subject to the same rate limits as anonymous API access.

## Next Steps

- [Installation](/docs/mcp/installation) -- Client-specific setup guides and configuration
- [Tools](/docs/mcp/tools) -- Detailed tool reference with parameters and examples
- [Resources & Prompts](/docs/mcp/resources-and-prompts) -- URI scheme and prompt templates
- [Security](/docs/mcp/security) -- Rate limiting, injection defense, and response budgets
