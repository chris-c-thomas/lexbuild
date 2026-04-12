/**
 * Test app factory for API integration tests.
 *
 * Creates a fully-configured Hono app backed by a temporary SQLite database
 * seeded with fixture data. Each test file gets an isolated database.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "./app.js";
import { createTestDatabase } from "./db/test-fixtures.js";
import { closeDatabase } from "./db/client.js";
import { initKeysDatabase, closeKeysDatabase, generateApiKey, createApiKeyRecord } from "./db/keys.js";

export interface TestContext {
  app: OpenAPIHono;
  /** Plaintext API key for the "standard" tier test key. */
  apiKey: string;
  /** Cleanup function — call in afterAll(). */
  cleanup: () => void;
}

/**
 * Set up a test app with a populated database and API key.
 * Call in beforeAll(), use cleanup() in afterAll().
 *
 * Singleton note: createDatabase() and initKeysDatabase() use module-level
 * singletons. Vitest isolates module state per test file (worker_threads),
 * so each file gets fresh singletons. Do NOT call setupTestApp() more than
 * once per test file.
 */
export function setupTestApp(): TestContext {
  const tmpDir = mkdtempSync(join(tmpdir(), "lexbuild-api-test-"));

  const dbPath = join(tmpDir, "test.db");
  const keysDbPath = join(tmpDir, "test-keys.db");

  // Populate content database with fixtures (uses its own Database instance)
  const contentDb = createTestDatabase(dbPath);
  contentDb.close();

  // Populate keys database via the singleton initKeysDatabase (reused by createApp)
  const keysDb = initKeysDatabase(keysDbPath);
  const { key, hash, prefix } = generateApiKey();
  createApiKeyRecord(keysDb, {
    hash,
    prefix,
    label: "test-key",
    tier: "standard",
    rateLimit: 1000,
    rateWindow: 60,
  });
  // Do NOT close keysDb — createApp reuses the singleton from initKeysDatabase

  // createApp opens the content DB via createDatabase (fresh singleton) and
  // reuses the already-initialized keys DB singleton
  const app = createApp({ dbPath, keysDbPath });

  return {
    app,
    apiKey: key,
    cleanup: () => {
      closeDatabase();
      closeKeysDatabase();
      rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}
