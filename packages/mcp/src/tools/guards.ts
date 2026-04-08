/**
 * Response budget enforcement.
 * Prevents oversized responses from exhausting model context windows.
 */
import { McpServerError } from "../server/errors.js";

/** Throws if the serialized payload exceeds the byte budget. */
export function enforceResponseBudget<T>(payload: T, maxBytes: number): T {
  const serialized = JSON.stringify(payload);
  const size = Buffer.byteLength(serialized, "utf8");
  if (size <= maxBytes) return payload;

  throw new McpServerError(
    "response_too_large",
    `Response of ${size} bytes exceeds budget of ${maxBytes} bytes. ` + `Narrow the query or use pagination.`,
  );
}
