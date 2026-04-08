/**
 * Registers all MCP prompts with the server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerDeps } from "../server/create-server.js";
import { registerCiteStatutePrompt } from "./cite-statute.js";
import { registerSummarizeSectionPrompt } from "./summarize-section.js";

/** Registers all v1 prompts on the MCP server. */
export function registerPrompts(server: McpServer, deps: ServerDeps): void {
  registerCiteStatutePrompt(server, deps);
  registerSummarizeSectionPrompt(server, deps);

  deps.logger.debug("Registered 2 MCP prompts");
}
