import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  // Bundle all dependencies except native bindings and workspace deps
  noExternal: [/(.*)/],
  external: ["better-sqlite3", "@lexbuild/core"],
  // Provide CJS globals for dependencies that assume CommonJS context
  banner: {
    js: [
      'import { createRequire } from "node:module";',
      'import { fileURLToPath as __node_fileURLToPath } from "node:url";',
      'import { dirname as __node_dirname } from "node:path";',
      "const require = createRequire(import.meta.url);",
      "const __filename = __node_fileURLToPath(import.meta.url);",
      "const __dirname = __node_dirname(__filename);",
    ].join(" "),
  },
});
