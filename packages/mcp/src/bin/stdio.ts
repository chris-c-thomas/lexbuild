/**
 * Stdio transport entrypoint for local MCP client integration.
 * Spawned as a subprocess by Claude Desktop, Claude Code, Cursor, etc.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server/create-server.js";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { LexBuildApiClient } from "../api/client.js";
import { VERSION } from "../lib/version.js";

try {
  const config = loadConfig();
  const logger = createLogger(config.LEXBUILD_MCP_LOG_LEVEL, { service: "lexbuild-mcp" });
  const api = new LexBuildApiClient({
    baseUrl: config.LEXBUILD_API_URL,
    apiKey: config.LEXBUILD_API_KEY,
    logger,
  });

  const server = createServer({ config, logger, api, version: VERSION });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("lexbuild-mcp ready", { transport: "stdio", version: VERSION });
} catch (err) {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "lexbuild-mcp failed to start",
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
}
