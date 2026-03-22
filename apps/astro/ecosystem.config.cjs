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
  ],
};
