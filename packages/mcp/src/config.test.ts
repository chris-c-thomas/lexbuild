import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  const originalEnv = process.env;
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    process.env = { ...originalEnv };
    exitSpy.mockClear();
    errorSpy.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads valid config with all defaults", () => {
    // No API key required (anonymous mode)
    const config = loadConfig();
    expect(config.LEXBUILD_API_URL).toBe("https://api.lexbuild.dev");
    expect(config.LEXBUILD_API_KEY).toBeUndefined();
    expect(config.LEXBUILD_MCP_HTTP_PORT).toBe(3030);
    expect(config.LEXBUILD_MCP_HTTP_HOST).toBe("127.0.0.1");
    expect(config.LEXBUILD_MCP_MAX_RESPONSE_BYTES).toBe(256_000);
    expect(config.LEXBUILD_MCP_RATE_LIMIT_PER_MIN).toBe(60);
    expect(config.LEXBUILD_MCP_LOG_LEVEL).toBe("info");
    expect(config.LEXBUILD_MCP_ENV).toBe("production");
  });

  it("loads config with explicit values", () => {
    process.env.LEXBUILD_API_URL = "http://localhost:4322";
    process.env.LEXBUILD_API_KEY = "lxb_test_abcdef123456";
    process.env.LEXBUILD_MCP_HTTP_PORT = "8080";
    process.env.LEXBUILD_MCP_LOG_LEVEL = "debug";
    process.env.LEXBUILD_MCP_ENV = "development";

    const config = loadConfig();
    expect(config.LEXBUILD_API_URL).toBe("http://localhost:4322");
    expect(config.LEXBUILD_API_KEY).toBe("lxb_test_abcdef123456");
    expect(config.LEXBUILD_MCP_HTTP_PORT).toBe(8080);
    expect(config.LEXBUILD_MCP_LOG_LEVEL).toBe("debug");
    expect(config.LEXBUILD_MCP_ENV).toBe("development");
  });

  it("coerces numeric string values", () => {
    process.env.LEXBUILD_MCP_HTTP_PORT = "9090";
    process.env.LEXBUILD_MCP_MAX_RESPONSE_BYTES = "512000";
    process.env.LEXBUILD_MCP_RATE_LIMIT_PER_MIN = "120";

    const config = loadConfig();
    expect(config.LEXBUILD_MCP_HTTP_PORT).toBe(9090);
    expect(config.LEXBUILD_MCP_MAX_RESPONSE_BYTES).toBe(512_000);
    expect(config.LEXBUILD_MCP_RATE_LIMIT_PER_MIN).toBe(120);
  });

  it("exits on invalid API URL", () => {
    process.env.LEXBUILD_API_URL = "not-a-url";
    loadConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on API key shorter than 8 characters", () => {
    process.env.LEXBUILD_API_KEY = "short";
    loadConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on invalid log level", () => {
    process.env.LEXBUILD_MCP_LOG_LEVEL = "verbose";
    loadConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on invalid environment", () => {
    process.env.LEXBUILD_MCP_ENV = "test";
    loadConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on negative port", () => {
    process.env.LEXBUILD_MCP_HTTP_PORT = "-1";
    loadConfig();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
