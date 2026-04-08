const LOG_DIR = "/home/ubuntu/pm2/logs/lexbuild";

module.exports = {
  apps: [
    {
      name: "lexbuild-astro",
      cwd: "/home/ubuntu/lexbuild/apps/astro",
      script: "./dist/server/entry.mjs",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "4321",
        CONTENT_DIR: process.env.CONTENT_DIR || "/srv/lexbuild/content",
        NAV_DIR: process.env.NAV_DIR || "/srv/lexbuild/nav",
        ENABLE_SEARCH: process.env.ENABLE_SEARCH || "false",
        MEILI_URL: "http://127.0.0.1:7700",
        MEILI_SEARCH_KEY: process.env.MEILI_SEARCH_KEY || "",
        SITE_URL: "https://lexbuild.dev",
      },
      instances: 1,
      exec_mode: "fork",

      // Logging
      out_file: `${LOG_DIR}/astro-out.log`,
      error_file: `${LOG_DIR}/astro-error.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // Stability
      max_memory_restart: "1536M",
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,

      // Graceful shutdown — allow in-flight SSR requests to complete
      kill_timeout: 5000,
    },
    {
      name: "meilisearch",
      cwd: "/home/ubuntu/lexbuild",
      script: "/usr/local/bin/meilisearch",
      args: "--db-path /var/lib/meilisearch/data --env production --http-addr 127.0.0.1:7700 --log-level WARN",
      env: {
        MEILI_MASTER_KEY: process.env.MEILI_MASTER_KEY || "",
      },
      instances: 1,
      exec_mode: "fork",

      // Logging
      out_file: `${LOG_DIR}/meilisearch-out.log`,
      error_file: `${LOG_DIR}/meilisearch-error.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // Stability
      max_memory_restart: "4G",
      max_restarts: 5,
      min_uptime: "10s",
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,

      // Meilisearch needs time to flush data on shutdown
      kill_timeout: 10000,
    },
    {
      name: "uptime-kuma",
      cwd: "/srv/uptime-kuma",
      script: "server/server.js",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",

      // Logging
      out_file: `${LOG_DIR}/uptime-kuma-out.log`,
      error_file: `${LOG_DIR}/uptime-kuma-error.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // Stability
      max_memory_restart: "512M",
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,

      kill_timeout: 5000,
    },
    {
      name: "lexbuild-mcp",
      cwd: "/home/ubuntu/lexbuild/packages/mcp",
      script: "./dist/bin/http.js",
      env: {
        NODE_ENV: "production",
        LEXBUILD_API_URL: "http://127.0.0.1:4322",
        LEXBUILD_API_KEY: process.env.LEXBUILD_MCP_API_KEY || "",
        LEXBUILD_MCP_HTTP_PORT: "3030",
        LEXBUILD_MCP_HTTP_HOST: "127.0.0.1",
        LEXBUILD_MCP_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",

      // Logging
      out_file: `${LOG_DIR}/mcp-out.log`,
      error_file: `${LOG_DIR}/mcp-error.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // Stability
      max_memory_restart: "512M",
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,

      kill_timeout: 5000,
    },
    {
      name: "lexbuild-api",
      cwd: "/home/ubuntu/lexbuild/apps/api",
      script: "./dist/index.js",
      env: {
        NODE_ENV: "production",
        API_PORT: "4322",
        LEXBUILD_DB_PATH: "/srv/lexbuild/data/lexbuild.db",
        LEXBUILD_KEYS_DB_PATH: "/srv/lexbuild/data/lexbuild-keys.db",
        MEILI_URL: "http://127.0.0.1:7700",
        MEILI_MASTER_KEY: process.env.MEILI_MASTER_KEY || "",
        MEILI_SEARCH_KEY: process.env.MEILI_SEARCH_KEY || "",
      },
      instances: 1,
      exec_mode: "fork",

      // Logging
      out_file: `${LOG_DIR}/api-out.log`,
      error_file: `${LOG_DIR}/api-error.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // Stability
      max_memory_restart: "1G",
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,

      kill_timeout: 5000,
    },
  ],
};
