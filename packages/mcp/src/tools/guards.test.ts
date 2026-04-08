import { describe, it, expect } from "vitest";
import { enforceResponseBudget } from "./guards.js";
import { McpServerError } from "../server/errors.js";

describe("enforceResponseBudget", () => {
  it("returns payload when within budget", () => {
    const data = { message: "hello" };
    expect(enforceResponseBudget(data, 1000)).toBe(data);
  });

  it("throws when payload exceeds budget", () => {
    const data = { message: "x".repeat(1000) };
    expect(() => enforceResponseBudget(data, 100)).toThrow(McpServerError);
    try {
      enforceResponseBudget(data, 100);
    } catch (err) {
      expect((err as McpServerError).code).toBe("response_too_large");
    }
  });

  it("uses byte length not string length for multibyte characters", () => {
    const data = { message: "\u{1F600}".repeat(100) };
    const serialized = JSON.stringify(data);
    const byteLength = Buffer.byteLength(serialized, "utf8");
    // Emoji is 4 bytes in UTF-8, so byte length exceeds string length
    expect(byteLength).toBeGreaterThan(serialized.length);
    // Should pass when budget is at or above byte length
    expect(() => enforceResponseBudget(data, byteLength)).not.toThrow();
    // Should fail when budget is below byte length
    expect(() => enforceResponseBudget(data, byteLength - 1)).toThrow();
  });
});
