---
title: "Installation"
description: "Set up the LexBuild MCP server in Claude Desktop, Claude Code, Cursor, and other MCP clients."
order: 2
---

# Installation

The LexBuild MCP server runs locally via `npx` and connects to the LexBuild Data API over the network. No local database or build step is required.

## Claude Desktop

Add to your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

Restart Claude Desktop after saving. You should see "lexbuild" listed in the MCP servers panel.

## Claude Code

Add to your project's `.mcp.json` or global MCP config:

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

## Cursor

Add to your Cursor MCP settings (Settings > MCP Servers):

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

## With an API Key

An API key is optional. Without one, requests use the anonymous rate limit (60 requests per minute). With a key, you get higher rate limits for sustained usage.

```json
{
  "mcpServers": {
    "lexbuild": {
      "command": "npx",
      "args": ["-y", "@lexbuild/mcp"],
      "env": {
        "LEXBUILD_API_KEY": "lxb_your_key_here"
      }
    }
  }
}
```

## Global Install

If you prefer a persistent installation over `npx`:

```bash
npm install -g @lexbuild/mcp
```

Then use `lexbuild-mcp` as the command instead of `npx`:

```json
{
  "mcpServers": {
    "lexbuild": {
      "command": "lexbuild-mcp"
    }
  }
}
```

## Hosted Endpoint

For clients that support the Streamable HTTP transport, you can connect directly to the hosted server without installing anything:

```
https://mcp.lexbuild.dev/mcp
```

No API key is required for basic usage. The hosted endpoint is subject to the same rate limits as anonymous access.

## Environment Variables

All configuration is optional. The defaults work for most setups.

| Variable | Default | Description |
|---|---|---|
| `LEXBUILD_API_URL` | `https://api.lexbuild.dev` | Data API base URL |
| `LEXBUILD_API_KEY` | -- | API key for higher rate limits |
| `LEXBUILD_MCP_LOG_LEVEL` | `info` | Log level: `error`, `warn`, `info`, `debug` |

These additional variables are only relevant if you are self-hosting the HTTP transport:

| Variable | Default | Description |
|---|---|---|
| `LEXBUILD_MCP_HTTP_PORT` | `3030` | HTTP server port |
| `LEXBUILD_MCP_HTTP_HOST` | `127.0.0.1` | HTTP server bind address |
| `LEXBUILD_MCP_MAX_RESPONSE_BYTES` | `256000` | Response size cap (256 KB) |
| `LEXBUILD_MCP_RATE_LIMIT_PER_MIN` | `60` | Anonymous rate limit (requests per minute) |
| `LEXBUILD_MCP_ENV` | `production` | Environment: `development`, `staging`, `production` |

## Verifying the Installation

After configuring your client, ask your AI assistant something like:

> "Search U.S. law for the Freedom of Information Act"

If the MCP server is connected, the assistant will use the `search_laws` tool and return results from the U.S. Code.
