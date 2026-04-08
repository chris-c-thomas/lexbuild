import { describe, it, expect } from "vitest";
import { McpServerError } from "./errors.js";

describe("McpServerError", () => {
  it("creates an error with code and message", () => {
    const err = new McpServerError("not_found", "Section not found");
    expect(err.code).toBe("not_found");
    expect(err.message).toBe("Section not found");
    expect(err.name).toBe("McpServerError");
    expect(err).toBeInstanceOf(Error);
  });

  it("supports cause chaining", () => {
    const cause = new Error("fetch failed");
    const err = new McpServerError("api_error", "Data API request failed", { cause });
    expect(err.cause).toBe(cause);
  });

  it("preserves error codes for programmatic handling", () => {
    const err = new McpServerError("rate_limited", "Too many requests");
    expect(err.code).toBe("rate_limited");
  });

  it("creates response_too_large errors", () => {
    const err = new McpServerError("response_too_large", "Response of 512000 bytes exceeds budget of 256000 bytes");
    expect(err.code).toBe("response_too_large");
    expect(err.message).toContain("512000");
  });
});
