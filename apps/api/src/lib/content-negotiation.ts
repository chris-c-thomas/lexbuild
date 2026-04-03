import type { Context } from "hono";

export type ResponseFormat = "json" | "markdown" | "text";

/**
 * Determine the response format from the request.
 * Priority: ?format= query param > Accept header > default (json)
 */
export function resolveFormat(c: Context): ResponseFormat {
  const formatParam = c.req.query("format");
  if (formatParam === "markdown") return "markdown";
  if (formatParam === "text") return "text";
  if (formatParam === "json") return "json";

  const accept = c.req.header("Accept") ?? "";
  if (accept.includes("text/markdown")) return "markdown";
  if (accept.includes("text/plain")) return "text";

  return "json";
}
