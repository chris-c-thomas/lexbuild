/**
 * HTTP transport entrypoint for the hosted MCP server at mcp.lexbuild.dev.
 * Serves Streamable HTTP transport via Hono.
 */
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";
import { LexBuildApiClient } from "../api/client.js";
import { startHttpServer } from "../transport/http.js";
import { VERSION } from "../lib/version.js";

try {
  const config = loadConfig();
  const logger = createLogger(config.LEXBUILD_MCP_LOG_LEVEL, { service: "lexbuild-mcp" });
  const api = new LexBuildApiClient({
    baseUrl: config.LEXBUILD_API_URL,
    apiKey: config.LEXBUILD_API_KEY,
    logger,
  });

  await startHttpServer({ config, logger, api, version: VERSION }, logger);
} catch (err) {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "lexbuild-mcp HTTP server failed to start",
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
}
