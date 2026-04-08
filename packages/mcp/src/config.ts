/**
 * Environment-variable-driven configuration validated through Zod at startup.
 * Fails fast if any required variable is missing or malformed.
 */
import { z } from "zod";

const ConfigSchema = z.object({
  /** Base URL of the LexBuild Data API. */
  LEXBUILD_API_URL: z.string().url().default("https://api.lexbuild.dev"),

  /** Optional API key for higher rate limits. Omit for anonymous access. */
  LEXBUILD_API_KEY: z.string().min(8).optional(),

  /** Port for the HTTP transport server. */
  LEXBUILD_MCP_HTTP_PORT: z.coerce.number().int().positive().default(3030),

  /** Host for the HTTP transport server. Defaults to loopback for safety. */
  LEXBUILD_MCP_HTTP_HOST: z.string().default("127.0.0.1"),

  /** Hard cap on any single tool response in bytes. */
  LEXBUILD_MCP_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(256_000),

  /** Default rate limit for anonymous MCP sessions (requests per minute). */
  LEXBUILD_MCP_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),

  /** Log level for the MCP server. */
  LEXBUILD_MCP_LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),

  /** Deployment environment. */
  LEXBUILD_MCP_ENV: z.enum(["development", "staging", "production"]).default("production"),
});

/** Validated MCP server configuration. */
export type Config = z.infer<typeof ConfigSchema>;

/** Loads and validates configuration from environment variables. */
export function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    console.error("Invalid MCP server configuration:", errors);
    process.exit(1);
  }
  return parsed.data;
}
