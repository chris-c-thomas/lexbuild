/**
 * Shared error handling wrapper for MCP tool, resource, and prompt handlers.
 * Logs errors and wraps non-McpServerError exceptions.
 */
import type { Logger } from "../lib/logger.js";
import { McpServerError } from "../server/errors.js";

/**
 * Wraps an async handler with structured error logging and McpServerError normalization.
 * Non-McpServerError exceptions are wrapped as internal_error with cause chaining.
 */
export function withErrorHandling<TInput, TOutput>(
  handlerName: string,
  logger: Logger,
  fn: (input: TInput) => Promise<TOutput>,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput) => {
    try {
      return await fn(input);
    } catch (err) {
      logger.error(`${handlerName} failed`, {
        handler: handlerName,
        error: err instanceof Error ? err.message : String(err),
      });
      if (err instanceof McpServerError) throw err;
      throw new McpServerError("internal_error", `Unexpected error in ${handlerName}`, {
        cause: err,
      });
    }
  };
}
