/**
 * Typed HTTP client for the LexBuild Data API.
 * Uses Node 22 built-in fetch with optional bearer auth, egress validation, and error mapping.
 */
import type { Logger } from "../lib/logger.js";
import { McpServerError } from "../server/errors.js";
import { VERSION } from "../lib/version.js";
import type {
  SearchParams,
  SearchResponse,
  DocumentResponse,
  TitlesResponse,
  TitleDetailResponse,
  YearsResponse,
  YearDetailResponse,
  HealthResponse,
} from "./types.js";

/** API source identifiers used in URL paths. */
export type ApiSource = "usc" | "cfr" | "fr";

/** Options for creating a LexBuild API client. */
export interface ApiClientOptions {
  baseUrl: string;
  apiKey?: string | undefined;
  logger: Logger;
}

/** Typed client for the LexBuild Data API. */
export class LexBuildApiClient {
  private readonly baseUrl: string;
  private readonly allowedHost: string;
  private readonly apiKey: string | undefined;
  private readonly logger: Logger;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.allowedHost = new URL(this.baseUrl).host;
    this.apiKey = options.apiKey;
    this.logger = options.logger.child({ component: "api-client" });
  }

  /** Makes a validated request to the Data API. */
  private async request(path: string, options?: { signal?: AbortSignal | undefined }): Promise<Response> {
    const url = new URL(path, this.baseUrl);

    // SSRF protection: only allow requests to the configured API host
    if (url.host !== this.allowedHost) {
      throw new McpServerError(
        "validation_error",
        `Request to ${url.host} blocked: only ${this.allowedHost} is allowed`,
      );
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": `lexbuild-mcp/${VERSION}`,
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const init: RequestInit = { headers };
    if (options?.signal) {
      init.signal = options.signal;
    }

    const response = await fetch(url.toString(), init);

    if (!response.ok) {
      this.logger.warn("API request failed", {
        path,
        status: response.status,
      });

      if (response.status === 404) {
        throw new McpServerError("not_found", `Not found: ${path}`);
      }
      if (response.status === 429) {
        throw new McpServerError("rate_limited", "Data API rate limit exceeded");
      }
      throw new McpServerError("api_error", `Data API returned ${response.status} for ${path}`);
    }

    return response;
  }

  /** Parses a JSON response, mapping network errors to McpServerError. */
  private async json<T>(path: string, options?: { signal?: AbortSignal | undefined }): Promise<T> {
    try {
      const response = await this.request(path, options);
      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof McpServerError) throw err;
      if (err instanceof SyntaxError) {
        throw new McpServerError("api_error", `Data API returned invalid JSON for ${path}`, {
          cause: err,
        });
      }
      throw new McpServerError("api_unavailable", "Data API is unreachable", { cause: err });
    }
  }

  /** Full-text search across all sources. */
  async search(params: SearchParams): Promise<SearchResponse> {
    const query = new URLSearchParams();
    query.set("q", params.q);
    if (params.source) query.set("source", params.source);
    if (params.title_number !== undefined) query.set("title_number", String(params.title_number));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.offset !== undefined) query.set("offset", String(params.offset));

    return this.json<SearchResponse>(`/api/search?${query.toString()}`, {
      signal: params.signal,
    });
  }

  /** Fetch a single document by source and identifier. */
  async getDocument(
    source: ApiSource,
    identifier: string,
    options?: { format?: "json" | "markdown"; signal?: AbortSignal | undefined },
  ): Promise<DocumentResponse> {
    const encodedId = encodeURIComponent(identifier);
    const format = options?.format ?? "json";
    return this.json<DocumentResponse>(`/api/${source}/documents/${encodedId}?format=${format}`, {
      signal: options?.signal,
    });
  }

  /** Fetch document markdown body directly. */
  async getDocumentMarkdown(
    source: ApiSource,
    identifier: string,
    options?: { signal?: AbortSignal | undefined },
  ): Promise<string> {
    try {
      const encodedId = encodeURIComponent(identifier);
      const response = await this.request(`/api/${source}/documents/${encodedId}?format=markdown`, {
        signal: options?.signal,
      });
      return await response.text();
    } catch (err) {
      if (err instanceof McpServerError) throw err;
      throw new McpServerError("api_unavailable", "Data API is unreachable", { cause: err });
    }
  }

  /** List titles for USC or CFR. */
  async listTitles(source: "usc" | "cfr", options?: { signal?: AbortSignal | undefined }): Promise<TitlesResponse> {
    return this.json<TitlesResponse>(`/api/${source}/titles`, options);
  }

  /** Get detail for a specific title (chapters). */
  async getTitleDetail(
    source: "usc" | "cfr",
    titleNumber: number,
    options?: { signal?: AbortSignal | undefined },
  ): Promise<TitleDetailResponse> {
    return this.json<TitleDetailResponse>(`/api/${source}/titles/${titleNumber}`, options);
  }

  /** List FR years. */
  async listYears(options?: { signal?: AbortSignal | undefined }): Promise<YearsResponse> {
    return this.json<YearsResponse>("/api/fr/years", options);
  }

  /** Get detail for a specific FR year (months). */
  async getYearDetail(year: number, options?: { signal?: AbortSignal | undefined }): Promise<YearDetailResponse> {
    return this.json<YearDetailResponse>(`/api/fr/years/${year}`, options);
  }

  /** Health check — also validates API key if one is configured. */
  async healthCheck(options?: { signal?: AbortSignal | undefined }): Promise<HealthResponse> {
    return this.json<HealthResponse>("/api/health", options);
  }
}
