/**
 * Registers all MCP tools with the server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { registerSearchLawsTool } from "./search-laws.js";
import { registerGetSectionTool } from "./get-section.js";
import { registerListTitlesTool } from "./list-titles.js";
import { registerGetTitleTool } from "./get-title.js";
import { registerGetFrDocumentTool } from "./get-federal-register-document.js";

/** Registers all v1 tools on the MCP server. */
export function registerTools(server: McpServer, deps: ServerDeps): void {
  registerSearchLawsTool(server, deps);
  registerGetSectionTool(server, deps);
  registerListTitlesTool(server, deps);
  registerGetTitleTool(server, deps);
  registerGetFrDocumentTool(server, deps);

  deps.logger.debug("Registered 5 MCP tools");
}
