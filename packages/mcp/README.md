# @lexbuild/mcp

Model Context Protocol server for [LexBuild](https://lexbuild.dev). Gives AI agents direct access to U.S. legal sources: the U.S. Code, Code of Federal Regulations, and Federal Register.

## Install

```bash
npx @lexbuild/mcp
```

Or install globally:

```bash
npm install -g @lexbuild/mcp
```

## Configuration

### Claude Desktop

Add to your Claude Desktop MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

### Claude Code

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

### With an API key (optional, for higher rate limits)

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

## Tools

| Tool | Description |
|------|-------------|
| `search_laws` | Full-text search across USC, CFR, and Federal Register |
| `get_section` | Fetch a single legal section by identifier |
| `list_titles` | List available titles (USC/CFR) or years (FR) |
| `get_title` | Get title detail with chapters, or year detail with months |
| `get_federal_register_document` | Fetch an FR document by document number |

## Resources

URI-addressable legal sections via the `lexbuild://` scheme:

- `lexbuild://us/usc/t{title}/s{section}` — U.S. Code section
- `lexbuild://us/cfr/t{title}/s{section}` — CFR section
- `lexbuild://us/fr/{document_number}` — Federal Register document

## Prompts

| Prompt | Description |
|--------|-------------|
| `cite_statute` | Generate a Bluebook citation for a USC or CFR section |
| `summarize_section` | Plain-language summary with audience targeting |

## Hosted Endpoint

A hosted MCP server is available at `mcp.lexbuild.dev` using the Streamable HTTP transport. No API key required for basic usage.

## Security

- All legal text is wrapped with injection defense markers
- Response sizes are capped at 256KB to protect model context
- SSRF protection via egress host allowlist
- Rate limiting per session (anonymous: 60 req/min)

## License

MIT
