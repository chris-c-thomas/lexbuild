---
title: "Resources & Prompts"
description: "MCP resource URI templates and prompt templates for citations and summaries."
order: 4
---

# Resources & Prompts

In addition to [tools](/docs/mcp/tools), the LexBuild MCP server exposes resources (URI-addressable legal sections) and prompts (reusable prompt templates).

## Resources

Resources let MCP clients reference legal sections by URI. The `lexbuild://` scheme maps directly to canonical identifiers in the LexBuild corpus.

### URI Templates

| Resource | URI Template | Example |
|---|---|---|
| U.S. Code section | `lexbuild://us/usc/t{title}/s{section}` | `lexbuild://us/usc/t5/s552` |
| CFR section | `lexbuild://us/cfr/t{title}/s{section}` | `lexbuild://us/cfr/t17/s240.10b-5` |
| FR document | `lexbuild://us/fr/{document_number}` | `lexbuild://us/fr/2026-06029` |

When a client reads a resource URI, the MCP server fetches the corresponding section from the Data API and returns its full Markdown content with metadata.

### When to Use Resources vs. Tools

- **Resources** are best when you already know the exact identifier and want to attach the content to the conversation context.
- **Tools** (`search_laws`, `get_section`) are best when you need to search, discover identifiers, or want structured JSON output.

Most MCP clients call tools automatically based on user intent. Resources are more commonly used by clients that support explicit resource attachment.

---

## Prompts

Prompts are reusable templates that guide the AI assistant toward a specific task. The LexBuild MCP server provides two prompts.

### cite_statute

Generate a properly formatted Bluebook citation for a U.S. Code or CFR section.

**Arguments:**

| Argument | Type | Required | Description |
|---|---|---|---|
| `source` | `"usc"` \| `"cfr"` | Yes | Legal source |
| `identifier` | string | Yes | Section identifier (e.g., `/us/usc/t5/s552`, `t17/s240.10b-5`) |

**What it does:** Fetches the section metadata from the Data API and constructs a prompt asking the assistant to generate an accurate Bluebook citation using the title, section number, and official name.

**Example output:**

> 5 U.S.C. SS 552 (2024).

---

### summarize_section

Generate a plain-language summary of a legal section with key definitions and provisions.

**Arguments:**

| Argument | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | `"usc"` \| `"cfr"` \| `"fr"` | Yes | -- | Legal source |
| `identifier` | string | Yes | -- | Section identifier or FR document number |
| `audience` | `"general"` \| `"legal"` \| `"technical"` | No | `"general"` | Target audience |

**Audience targeting:**

| Audience | Description |
|---|---|
| `general` | No legal background assumed. Avoids jargon. Explains legal terms in plain English. |
| `legal` | For legal professionals. Uses standard legal terminology. Focuses on operative provisions and exceptions. |
| `technical` | For compliance audiences. Focuses on specific requirements, deadlines, and actionable obligations. |

**What it does:** Fetches the full section text and metadata, then constructs a prompt asking the assistant to produce a structured summary including a one-paragraph overview, key definitions, main provisions, and notable exceptions.
