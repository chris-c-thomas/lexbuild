import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as {
  version: string;
};

const define = {
  __PKG_VERSION__: JSON.stringify(pkg.version),
};

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    define,
  },
  {
    entry: { "bin/stdio": "src/bin/stdio.ts", "bin/http": "src/bin/http.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    define,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
