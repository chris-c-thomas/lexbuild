import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { API_KEYS_TABLE_SQL } from "@lexbuild/core";
import { generateApiKey, hashApiKey, validateApiKey, trackUsage, createApiKeyRecord } from "./keys.js";

describe("API key functions", () => {
  let keysDb: Database.Database;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "lexbuild-keys-test-"));
    const dbPath = join(tmpDir, "test-keys.db");
    keysDb = new Database(dbPath);
    keysDb.pragma("journal_mode = WAL");
    keysDb.exec(API_KEYS_TABLE_SQL);
  });

  afterAll(() => {
    keysDb.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("generateApiKey", () => {
    it("returns a key starting with lxb_", () => {
      const { key } = generateApiKey();
      expect(key.startsWith("lxb_")).toBe(true);
    });

    it("returns a hex hash", () => {
      const { hash } = generateApiKey();
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns a prefix of the first 12 characters", () => {
      const { key, prefix } = generateApiKey();
      expect(prefix).toBe(key.slice(0, 12));
    });

    it("generates unique keys on each call", () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(a.key).not.toBe(b.key);
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe("hashApiKey", () => {
    it("is deterministic for the same input", () => {
      const key = "lxb_test_deterministic_key_12345";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different keys", () => {
      const hash1 = hashApiKey("lxb_key_one");
      const hash2 = hashApiKey("lxb_key_two");
      expect(hash1).not.toBe(hash2);
    });

    it("returns a 64-char hex string", () => {
      const hash = hashApiKey("lxb_any_key");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("createApiKeyRecord", () => {
    it("returns a UUID", () => {
      const { hash, prefix } = generateApiKey();
      const id = createApiKeyRecord(keysDb, {
        hash,
        prefix,
        label: "test-create",
        tier: "standard",
        rateLimit: 1000,
        rateWindow: 60,
      });
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("persists the record in the database", () => {
      const { hash, prefix } = generateApiKey();
      const id = createApiKeyRecord(keysDb, {
        hash,
        prefix,
        label: "test-persist",
        tier: "elevated",
        rateLimit: 5000,
        rateWindow: 60,
      });
      const row = keysDb.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as Record<string, unknown>;
      expect(row.key_hash).toBe(hash);
      expect(row.key_prefix).toBe(prefix);
      expect(row.label).toBe("test-persist");
      expect(row.tier).toBe("elevated");
    });
  });

  describe("validateApiKey", () => {
    it("returns data for a valid key", () => {
      const { key, hash, prefix } = generateApiKey();
      createApiKeyRecord(keysDb, {
        hash,
        prefix,
        label: "test-valid",
        tier: "standard",
        rateLimit: 1000,
        rateWindow: 60,
      });

      const result = validateApiKey(keysDb, key);
      expect(result).not.toBeNull();
      expect(result!.tier).toBe("standard");
      expect(result!.rate_limit).toBe(1000);
      expect(result!.rate_window).toBe(60);
    });

    it("returns null for nonexistent key", () => {
      const result = validateApiKey(keysDb, "lxb_nonexistent_key_0000000000");
      expect(result).toBeNull();
    });

    it("returns null for a revoked key", () => {
      const { key, hash, prefix } = generateApiKey();
      const id = createApiKeyRecord(keysDb, {
        hash,
        prefix,
        label: "test-revoked",
        tier: "standard",
        rateLimit: 1000,
        rateWindow: 60,
      });
      keysDb.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?").run(id);

      const result = validateApiKey(keysDb, key);
      expect(result).toBeNull();
    });

    it("returns null for an expired key", () => {
      const { key, hash, prefix } = generateApiKey();
      createApiKeyRecord(keysDb, {
        hash,
        prefix,
        label: "test-expired",
        tier: "standard",
        rateLimit: 1000,
        rateWindow: 60,
        expiresAt: "2020-01-01T00:00:00Z",
      });

      const result = validateApiKey(keysDb, key);
      expect(result).toBeNull();
    });
  });

  describe("trackUsage", () => {
    it("increments total_requests", () => {
      const { hash, prefix } = generateApiKey();
      const id = createApiKeyRecord(keysDb, {
        hash,
        prefix,
        label: "test-usage",
        tier: "standard",
        rateLimit: 1000,
        rateWindow: 60,
      });

      trackUsage(keysDb, id);
      trackUsage(keysDb, id);
      trackUsage(keysDb, id);

      const row = keysDb.prepare("SELECT total_requests FROM api_keys WHERE id = ?").get(id) as {
        total_requests: number;
      };
      expect(row.total_requests).toBe(3);
    });

    it("updates last_used timestamp", () => {
      const { hash, prefix } = generateApiKey();
      const id = createApiKeyRecord(keysDb, {
        hash,
        prefix,
        label: "test-last-used",
        tier: "standard",
        rateLimit: 1000,
        rateWindow: 60,
      });

      const before = keysDb.prepare("SELECT last_used FROM api_keys WHERE id = ?").get(id) as {
        last_used: string | null;
      };
      expect(before.last_used).toBeNull();

      trackUsage(keysDb, id);

      const after = keysDb.prepare("SELECT last_used FROM api_keys WHERE id = ?").get(id) as {
        last_used: string | null;
      };
      expect(after.last_used).not.toBeNull();
    });
  });
});
