import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  // ── Package boundary rules ──
  // Source packages depend only on core, never on each other.
  {
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@lexbuild/usc", "@lexbuild/ecfr", "@lexbuild/fr", "@lexbuild/cli", "@lexbuild/mcp"],
              message: "core must not import from source or adapter packages",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/usc/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@lexbuild/ecfr", "@lexbuild/fr", "@lexbuild/cli", "@lexbuild/mcp"],
              message: "source packages must not import from each other",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/ecfr/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@lexbuild/usc", "@lexbuild/fr", "@lexbuild/cli", "@lexbuild/mcp"],
              message: "source packages must not import from each other",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/fr/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@lexbuild/usc", "@lexbuild/ecfr", "@lexbuild/cli", "@lexbuild/mcp"],
              message: "source packages must not import from each other",
            },
          ],
        },
      ],
    },
  },
  // packages/mcp/ restrictions — fully independent, no internal deps
  {
    files: ["packages/mcp/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@lexbuild/core", "@lexbuild/usc", "@lexbuild/ecfr", "@lexbuild/fr", "@lexbuild/cli"],
              message: "MCP package must not import internal packages",
            },
          ],
        },
      ],
    },
  },
  // apps/api/ restrictions
  {
    files: ["apps/api/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@lexbuild/usc*"], message: "API app must not import source packages" },
            { group: ["@lexbuild/ecfr*"], message: "API app must not import source packages" },
            { group: ["@lexbuild/fr*"], message: "API app must not import source packages" },
            { group: ["@lexbuild/cli*"], message: "API app must not import CLI package" },
            { group: ["@lexbuild/mcp*"], message: "API app must not import MCP package" },
          ],
        },
      ],
    },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.config.ts", "**/*.config.js"],
  },
);
