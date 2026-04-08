/**
 * Creates and configures the LexBuild MCP server with tools, resources, and prompts.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import type { Logger } from "../lib/logger.js";
import type { LexBuildApiClient } from "../api/client.js";
import { registerTools } from "../tools/register.js";
import { registerResources } from "../resources/register.js";
import { registerPrompts } from "../prompts/register.js";

/** Dependencies injected into the MCP server. */
export interface ServerDeps {
  config: Config;
  logger: Logger;
  api: LexBuildApiClient;
  version: string;
}

/** Creates a configured MCP server instance. */
export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({
    name: "lexbuild",
    version: deps.version,
  });

  registerTools(server, deps);
  registerResources(server, deps);
  registerPrompts(server, deps);

  deps.logger.info("MCP server created", { version: deps.version });

  return server;
}
