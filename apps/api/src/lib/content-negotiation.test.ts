import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { resolveFormat } from "./content-negotiation.js";

/** Helper to test resolveFormat by making a request through a Hono app. */
async function getFormat(queryFormat?: string, acceptHeader?: string): Promise<string> {
  const app = new Hono();
  app.get("/test", (c) => c.json({ format: resolveFormat(c) }));

  const url = queryFormat ? `/test?format=${queryFormat}` : "/test";
  const headers: Record<string, string> = {};
  if (acceptHeader) headers.Accept = acceptHeader;

  const res = await app.request(url, { headers });
  const body = (await res.json()) as { format: string };
  return body.format;
}

describe("resolveFormat", () => {
  it("returns json by default", async () => {
    expect(await getFormat()).toBe("json");
  });

  it("returns json for ?format=json", async () => {
    expect(await getFormat("json")).toBe("json");
  });

  it("returns markdown for ?format=markdown", async () => {
    expect(await getFormat("markdown")).toBe("markdown");
  });

  it("returns text for ?format=text", async () => {
    expect(await getFormat("text")).toBe("text");
  });

  it("returns markdown for Accept: text/markdown", async () => {
    expect(await getFormat(undefined, "text/markdown")).toBe("markdown");
  });

  it("returns text for Accept: text/plain", async () => {
    expect(await getFormat(undefined, "text/plain")).toBe("text");
  });

  it("query param takes precedence over Accept header", async () => {
    expect(await getFormat("text", "text/markdown")).toBe("text");
  });

  it("falls back to json for unknown Accept header", async () => {
    expect(await getFormat(undefined, "application/xml")).toBe("json");
  });

  it("falls back to Accept header for unknown format param", async () => {
    expect(await getFormat("xml", "text/markdown")).toBe("markdown");
  });
});
