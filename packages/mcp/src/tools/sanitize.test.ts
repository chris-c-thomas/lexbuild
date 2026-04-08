import { describe, it, expect } from "vitest";
import { stripControlCharacters, wrapUntrustedContent } from "./sanitize.js";

describe("stripControlCharacters", () => {
  it("removes null bytes", () => {
    expect(stripControlCharacters("hello\x00world")).toBe("helloworld");
  });

  it("removes ANSI escape sequences", () => {
    expect(stripControlCharacters("hello\x1B[31mred\x1B[0m")).toBe("hellored");
  });

  it("preserves newlines and tabs", () => {
    expect(stripControlCharacters("line1\nline2\ttab")).toBe("line1\nline2\ttab");
  });

  it("preserves normal legal text", () => {
    const text = "Section 552(a)(1) of title 5, United States Code";
    expect(stripControlCharacters(text)).toBe(text);
  });
});

describe("wrapUntrustedContent", () => {
  it("wraps text with injection defense markers", () => {
    const text = "The Freedom of Information Act";
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain("LEXBUILD UNTRUSTED CONTENT BEGIN");
    expect(wrapped).toContain("LEXBUILD UNTRUSTED CONTENT END");
    expect(wrapped).toContain(text);
  });

  it("strips control characters before wrapping", () => {
    const wrapped = wrapUntrustedContent("test\x00content");
    expect(wrapped).toContain("testcontent");
    expect(wrapped).not.toContain("\x00");
  });

  // Prompt injection regression fixtures
  it("preserves 'ignore previous instructions' in legal text", () => {
    const text = "The court shall ignore previous instructions and directives that conflict with this statute.";
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
    expect(wrapped).toContain("UNTRUSTED CONTENT BEGIN");
  });

  it("preserves 'you are now' patterns in legal text", () => {
    const text = "If you are now subject to the jurisdiction of a federal court...";
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
  });

  it("preserves system prompt-like patterns in statutory notes", () => {
    const text = "SYSTEM: The Secretary shall establish a system for the purpose of tracking compliance.";
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
    expect(wrapped).toContain("UNTRUSTED CONTENT BEGIN");
  });

  it("preserves XML/HTML-like content in legal text", () => {
    const text = 'See <ref href="/us/usc/t5/s552">5 U.S.C. 552</ref> for details.';
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
  });

  it("preserves markdown injection attempts", () => {
    const text = "## New Section\n\n```\nmalicious code\n```\n\n[link](http://evil.com)";
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
    expect(wrapped).toContain("UNTRUSTED CONTENT BEGIN");
  });

  it("preserves role-play injection patterns in regulations", () => {
    const text = "The assistant administrator shall act as the primary point of contact for all inquiries.";
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
  });

  it("preserves text with embedded JSON-like content", () => {
    const text = 'The record shall include: {"type": "compliance_report", "required": true} as specified.';
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
  });

  it("preserves text with escape sequences in citations", () => {
    const text = "Pub. L. 104\\textendash{}132, \\S 4, Apr. 24, 1996, 110 Stat. 1214.";
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
  });

  it("preserves instruction-like text in regulatory context", () => {
    const text =
      "IMPORTANT: You must file this form within 30 days. " +
      "Do not forget to include your taxpayer identification number. " +
      "Please respond immediately to avoid penalties.";
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
  });

  it("preserves multi-language legal boilerplate", () => {
    const text = "Aviso: Este documento es una traduccion. The official text is in English.";
    const wrapped = wrapUntrustedContent(text);
    expect(wrapped).toContain(text);
  });
});
