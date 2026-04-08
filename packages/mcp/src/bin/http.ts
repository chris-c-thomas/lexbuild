/**
 * HTTP transport entrypoint for the hosted MCP server at mcp.lexbuild.dev.
 * Serves Streamable HTTP transport via Hono.
 */
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { LexBuildApiClient } from "../api/client.js";
import { startHttpServer } from "../transport/http.js";

const config = loadConfig();
const logger = createLogger(config.LEXBUILD_MCP_LOG_LEVEL, { service: "lexbuild-mcp" });
const api = new LexBuildApiClient({
  baseUrl: config.LEXBUILD_API_URL,
  apiKey: config.LEXBUILD_API_KEY,
  logger,
});

await startHttpServer({ config, logger, api, version: "0.1.0" }, logger);
