module.exports = {
  apps: [
    {
      name: "lexbuild-astro",
      cwd: __dirname,
      script: "./dist/server/entry.mjs",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "4321",
        CONTENT_DIR: process.env.CONTENT_DIR || "/srv/lexbuild/content",
        NAV_DIR: process.env.NAV_DIR || "/srv/lexbuild/nav",
        ENABLE_SEARCH: "false",
      },
      instances: 1,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};