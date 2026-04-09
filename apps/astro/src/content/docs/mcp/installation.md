---
title: "Installation"
description: "Set up the LexBuild MCP server in Claude Desktop, Claude Code, Cursor, VS Code, Zed, Warp, Codex CLI, Gemini CLI, and other MCP clients."
order: 2
---

# Installation

The LexBuild MCP server runs locally via `npx` and connects to the LexBuild Data API over the network. No local database or build step is required.

## Hosted Endpoint

For clients that support HTTP transport, you can connect to the hosted server with no installation:

```
https://mcp.lexbuild.dev/mcp
```

No API key is required for basic usage. The hosted endpoint is subject to the same rate limits as anonymous access. See the client-specific sections below for how to configure HTTP transport where supported.

## Global Install

If you prefer a persistent installation over `npx`, install globally:

```bash
npm install -g @lexbuild/mcp
```

Then use `lexbuild-mcp` as the command in any client configuration below instead of `npx`.

---

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

## Codex CLI

Add to `~/.codex/config.toml` (global) or `.codex/config.toml` (project):

```toml
[mcp_servers.lexbuild]
command = "npx"
args = ["-y", "@lexbuild/mcp"]
```

Or use the hosted endpoint:

```toml
[mcp_servers.lexbuild]
url = "https://mcp.lexbuild.dev/mcp"
```

> [!NOTE]
> Codex CLI uses TOML, not JSON. For API key auth, use `env = { "LEXBUILD_API_KEY" = "lxb_your_key_here" }`.

## Copilot CLI

Add to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "lexbuild": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@lexbuild/mcp"]
    }
  }
}
```

Or use the hosted endpoint:

```json
{
  "mcpServers": {
    "lexbuild": {
      "type": "http",
      "url": "https://mcp.lexbuild.dev/mcp"
    }
  }
}
```

> [!NOTE]
> Copilot CLI requires the `type` field: `"local"` for stdio servers, `"http"` for remote.

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

## Gemini CLI

Add to `~/.gemini/settings.json` (global) or `.gemini/settings.json` (project):

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

Or use the hosted endpoint:

```json
{
  "mcpServers": {
    "lexbuild": {
      "httpUrl": "https://mcp.lexbuild.dev/mcp"
    }
  }
}
```

> [!NOTE]
> Gemini CLI uses `httpUrl` (not `url`) for remote servers.

## VS Code

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "lexbuild": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@lexbuild/mcp"]
    }
  }
}
```

> [!NOTE]
> VS Code uses `servers` (not `mcpServers`) and requires the `type` field.

## Warp

Open Warp Settings > AI > MCP Servers and add:

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

Warp can also auto-detect MCP servers configured for other clients (Claude Desktop, Codex, Gemini CLI) via the "File-based MCP Servers" toggle in settings.

## Zed

Add to your Zed settings file (`~/.config/zed/settings.json` on macOS/Linux):

```json
{
  "context_servers": {
    "lexbuild": {
      "source": "custom",
      "command": "npx",
      "args": ["-y", "@lexbuild/mcp"]
    }
  }
}
```

Or use the hosted endpoint:

```json
{
  "context_servers": {
    "lexbuild": {
      "url": "https://mcp.lexbuild.dev/mcp"
    }
  }
}
```

> [!WARNING]
> The `"source": "custom"` field is required for stdio servers in Zed. Without it, Zed silently ignores the entry. The key is `context_servers`, not `mcpServers`.

---

## With an API Key

An API key is optional. Without one, requests use the anonymous rate limit (60 requests per minute). With a key, you get higher rate limits for sustained usage.

Add the key as an environment variable in your client config. For JSON-based clients:

```json
{
  "env": {
    "LEXBUILD_API_KEY": "lxb_your_key_here"
  }
}
```

For Codex CLI (TOML):

```toml
env = { "LEXBUILD_API_KEY" = "lxb_your_key_here" }
```

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
