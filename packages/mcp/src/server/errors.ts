/**
 * Typed error hierarchy for the MCP server.
 * Maps internal errors to structured MCP error responses.
 */

/** Error codes used by the MCP server. */
export type McpErrorCode =
  | "not_found"
  | "validation_error"
  | "response_too_large"
  | "rate_limited"
  | "api_error"
  | "api_unavailable"
  | "internal_error";

/** Structured error for the MCP server with a machine-readable code. */
export class McpServerError extends Error {
  constructor(
    public readonly code: McpErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "McpServerError";
  }
}
