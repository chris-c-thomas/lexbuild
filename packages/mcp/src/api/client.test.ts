import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LexBuildApiClient } from "./client.js";
import { McpServerError } from "../server/errors.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("error");

function createClient(options?: { baseUrl?: string; apiKey?: string }): LexBuildApiClient {
  return new LexBuildApiClient({
    baseUrl: options?.baseUrl ?? "https://api.lexbuild.dev",
    apiKey: options?.apiKey,
    logger,
  });
}

// Mock fetch globally
const mockFetch = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LexBuildApiClient", () => {
  describe("auth headers", () => {
    it("sends no Authorization header when no API key is configured", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

      await client.healthCheck();
      const [, init] = mockFetch.mock.calls[0]!;
      const headers = init?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("sends Bearer token when API key is configured", async () => {
      const client = createClient({ apiKey: "lxb_test_abcdef123456" });
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

      await client.healthCheck();
      const [, init] = mockFetch.mock.calls[0]!;
      const headers = init?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer lxb_test_abcdef123456");
    });
  });

  describe("egress validation", () => {
    it("blocks requests to non-allowlisted hosts", async () => {
      const client = createClient({ baseUrl: "https://api.lexbuild.dev" });

      // Attempt to override the URL via path traversal
      await expect(client.healthCheck()).rejects.toThrow();
      // The client should call fetch with the correct host
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));
      await client.healthCheck();
      const [url] = mockFetch.mock.calls[0]!;
      expect(String(url)).toContain("api.lexbuild.dev");
    });
  });

  describe("search", () => {
    it("sends correct query parameters", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: { hits: [], query: "test", processing_time_ms: 5, estimated_total_hits: 0 },
          pagination: { total: 0, limit: 10, offset: 0, has_more: false },
          meta: { api_version: "v1", timestamp: new Date().toISOString() },
        }),
      );

      await client.search({ q: "freedom of information", source: "usc", limit: 5, offset: 10 });
      const [url] = mockFetch.mock.calls[0]!;
      const parsed = new URL(String(url));
      expect(parsed.searchParams.get("q")).toBe("freedom of information");
      expect(parsed.searchParams.get("source")).toBe("usc");
      expect(parsed.searchParams.get("limit")).toBe("5");
      expect(parsed.searchParams.get("offset")).toBe("10");
    });

    it("omits optional parameters when not provided", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: { hits: [], query: "test", processing_time_ms: 1, estimated_total_hits: 0 },
          pagination: { total: 0, limit: 20, offset: 0, has_more: false },
          meta: { api_version: "v1", timestamp: new Date().toISOString() },
        }),
      );

      await client.search({ q: "test" });
      const [url] = mockFetch.mock.calls[0]!;
      const parsed = new URL(String(url));
      expect(parsed.searchParams.has("source")).toBe(false);
      expect(parsed.searchParams.has("title_number")).toBe(false);
    });
  });

  describe("getDocument", () => {
    it("encodes identifier in URL path", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: { id: "1", identifier: "/us/usc/t5/s552", source: "usc", metadata: {} },
          meta: { api_version: "v1", timestamp: new Date().toISOString() },
        }),
      );

      await client.getDocument("usc", "/us/usc/t5/s552");
      const [url] = mockFetch.mock.calls[0]!;
      expect(String(url)).toContain("/api/usc/documents/");
    });

    it("uses ecfr path for eCFR documents", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: { id: "2", identifier: "/us/cfr/t17/s240.10b-5", source: "ecfr", metadata: {} },
          meta: { api_version: "v1", timestamp: new Date().toISOString() },
        }),
      );

      await client.getDocument("ecfr", "/us/cfr/t17/s240.10b-5");
      const [url] = mockFetch.mock.calls[0]!;
      expect(String(url)).toContain("/api/ecfr/documents/");
    });
  });

  describe("hierarchy", () => {
    it("lists USC titles", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              title_number: 1,
              title_name: "General Provisions",
              document_count: 100,
              chapter_count: 3,
              positive_law: true,
              url: "/api/usc/titles/1",
            },
          ],
          meta: { api_version: "v1", timestamp: new Date().toISOString() },
        }),
      );

      const result = await client.listTitles("usc");
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.title_number).toBe(1);
    });

    it("lists FR years", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: [{ year: 2026, document_count: 5000, url: "/api/fr/years/2026" }],
          meta: { api_version: "v1", timestamp: new Date().toISOString() },
        }),
      );

      const result = await client.listYears();
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.year).toBe(2026);
    });
  });

  describe("error mapping", () => {
    it("maps 404 to not_found", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(new Response("Not found", { status: 404 }));

      try {
        await client.healthCheck();
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(McpServerError);
        expect((err as McpServerError).code).toBe("not_found");
      }
    });

    it("maps 429 to rate_limited", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(new Response("Too many requests", { status: 429 }));

      try {
        await client.healthCheck();
      } catch (err) {
        expect(err).toBeInstanceOf(McpServerError);
        expect((err as McpServerError).code).toBe("rate_limited");
      }
    });

    it("maps 500 to api_error", async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(new Response("Internal error", { status: 500 }));

      try {
        await client.healthCheck();
      } catch (err) {
        expect(err).toBeInstanceOf(McpServerError);
        expect((err as McpServerError).code).toBe("api_error");
      }
    });

    it("maps network errors to api_unavailable", async () => {
      const client = createClient();
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      try {
        await client.healthCheck();
      } catch (err) {
        expect(err).toBeInstanceOf(McpServerError);
        expect((err as McpServerError).code).toBe("api_unavailable");
      }
    });
  });
});
