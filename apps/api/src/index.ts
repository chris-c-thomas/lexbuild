import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { closeDatabase } from "./db/client.js";
import { closeKeysDatabase } from "./db/keys.js";

const port = parseInt(process.env.API_PORT ?? "4322", 10);
const dbPath = process.env.LEXBUILD_DB_PATH ?? "./lexbuild.db";
const keysDbPath = process.env.LEXBUILD_KEYS_DB_PATH ?? "./lexbuild-keys.db";
const meiliUrl = process.env.MEILI_URL ?? "http://127.0.0.1:7700";
const meiliKey = process.env.MEILI_SEARCH_KEY ?? process.env.MEILI_MASTER_KEY ?? "";
if (!meiliKey) {
  console.warn("WARNING: No MEILI_SEARCH_KEY or MEILI_MASTER_KEY set. Search endpoint will fail.");
}

const app = createApp({ dbPath, keysDbPath, meiliUrl, meiliKey });

console.log(`LexBuild API starting on port ${port}`);
console.log(`  Database: ${dbPath}`);
console.log(`  Keys DB: ${keysDbPath}`);
console.log(`  Meilisearch: ${meiliUrl}`);
console.log(`  OpenAPI docs: http://localhost:${port}/api/v1/docs`);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`LexBuild API listening on port ${info.port}`);
});

function shutdown(): void {
  closeDatabase();
  closeKeysDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down");
  shutdown();
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down");
  shutdown();
});
