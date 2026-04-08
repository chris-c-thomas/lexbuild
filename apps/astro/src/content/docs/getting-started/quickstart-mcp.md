---
title: "MCP Quickstart"
description: "Connect the LexBuild MCP server to Claude Desktop and start querying U.S. law in under a minute."
order: 5
---

# MCP Quickstart

Give your AI assistant direct access to the U.S. Code, Code of Federal Regulations, and Federal Register through the Model Context Protocol.

## Prerequisites

- [Claude Desktop](https://claude.ai/download), [Claude Code](https://claude.ai/claude-code), [Codex CLI](https://developers.openai.com/codex/cli), [Gemini CLI](https://geminicli.com/), [VS Code](https://code.visualstudio.com/), [Zed](https://zed.dev/),  or another MCP-compatible client
- Node.js 22 or later

## 1. Configure Your Client

Open your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the LexBuild server:

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

Save and restart Claude Desktop.

## 2. Try It Out

Ask Claude something that requires legal knowledge:

> "What does 5 USC 552 say about public access to government records?"

Claude will use the `search_laws` tool to find the section, then `get_section` to retrieve the full text of the Freedom of Information Act.

## 3. Explore Further

Try these example queries:

- **Search**: "Find CFR regulations about securities fraud"
- **Browse**: "List all titles in the U.S. Code"
- **Retrieve**: "Show me Federal Register document 2026-06029"
- **Cite**: "Generate a Bluebook citation for 17 CFR 240.10b-5"
- **Summarize**: "Summarize 42 USC 1983 for a general audience"

## What's Happening

When you ask a legal question, your AI assistant:

1. Calls `search_laws` to find relevant sections across all three sources
2. Calls `get_section` to fetch the full text of matching sections
3. Reads the Markdown content and metadata to answer your question

All data comes from the [LexBuild Data API](https://lexbuild.dev/api/health). No local database is needed.

## Next Steps

- [MCP Installation](/docs/mcp/installation) -- Setup for Claude Code, Cursor, and API key configuration
- [MCP Tools](/docs/mcp/tools) -- Full reference for all five tools
- [API Quickstart](/docs/getting-started/quickstart-api) -- Access the same data via REST API
