# Build Pipeline

LexBuild uses [Turborepo](https://turbo.build/) to orchestrate builds, tests, linting, and type-checking across the monorepo. Turborepo reads the dependency graph from each package's `package.json` and the task pipeline from `turbo.json`, then schedules work in the correct order with maximum parallelism. This page explains how the pipeline is configured, what each task does, and how the web app is handled separately.

## Pipeline Configuration

The build pipeline is defined in `turbo.json` at the repository root:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "lint:fix": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Each task entry defines when it can run (via `dependsOn`), what it produces (via `outputs`), and whether results are cached. The `^` prefix means "the same task in upstream dependencies" -- a critical distinction explained below.

## Build Order

The `build` task uses `"dependsOn": ["^build"]`, which means a package's build waits for all of its `workspace:*` dependencies to build first. Given the current [dependency graph](dependency-graph.md), this produces a deterministic build order:

```
Step 1:  @lexbuild/core        (no internal deps — builds first)
Step 2:  @lexbuild/usc         (depends on core)
Step 3:  @lexbuild/cli         (depends on core and usc)
```

Turborepo resolves this automatically. You never specify the order manually -- it is derived from the `workspace:*` dependencies in each `package.json`. If `@lexbuild/cfr` is added in the future with a dependency on `@lexbuild/core`, Turborepo would build it in parallel with `@lexbuild/usc` at step 2, since they are independent.

## Task Relationships

### `build`

```json
"build": {
  "dependsOn": ["^build"],
  "outputs": ["dist/**"]
}
```

- **`dependsOn: ["^build"]`** -- Wait for upstream packages to build. Core builds before usc; usc builds before cli.
- **`outputs: ["dist/**"]`** -- Turborepo caches the `dist/` directory. If source files have not changed since the last build, the task is skipped and the cached output is restored. This makes repeated builds near-instant.

### `typecheck`

```json
"typecheck": {
  "dependsOn": ["^build"]
}
```

- **`dependsOn: ["^build"]`** -- Type-checking a package requires that its upstream dependencies are built first. TypeScript needs the `.d.ts` declaration files in upstream `dist/` directories to resolve imported types.
- **No `outputs`** -- Type-checking produces no artifacts (it runs `tsc --noEmit`), so there is nothing to cache.

### `test`

```json
"test": {
  "dependsOn": ["build"]
}
```

- **`dependsOn: ["build"]`** -- Note the absence of `^`. This means tests depend on the *same package's* build, not upstream builds. The package's own build task already depends on `^build`, so upstream packages are transitively built first.
- Tests run via `vitest run`. Test files are co-located with source files (`parser.ts` and `parser.test.ts` in the same directory).

### `lint` and `lint:fix`

```json
"lint": {},
"lint:fix": {}
```

- **No `dependsOn`** -- Linting has no prerequisites. It runs against source files directly, without needing built output. This means linting can run in parallel with builds across different packages.
- All packages lint their `src/` directory via `eslint src`.

### Summary Table

| Task | Depends On | Outputs | Cached | Purpose |
|------|-----------|---------|--------|---------|
| `build` | `^build` (upstream builds) | `dist/**` | Yes | Compile TypeScript via tsup |
| `typecheck` | `^build` (upstream builds) | None | Yes | Run `tsc --noEmit` |
| `test` | `build` (own build) | None | Yes | Run `vitest run` |
| `lint` | None | None | Yes | Run `eslint src` |
| `lint:fix` | None | None | Yes | Run `eslint src --fix` |

## tsup: The Bundler

Every package uses [tsup](https://tsup.egoist.dev/) as its build tool. tsup wraps [esbuild](https://esbuild.github.io/) for fast TypeScript compilation and generates both JavaScript output and TypeScript declaration files.

### Shared Configuration

The `core` and `usc` packages use identical tsup configs:

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

| Option | Effect |
|--------|--------|
| `entry` | Single entry point at `src/index.ts` (the barrel export) |
| `format: ["esm"]` | ESM-only output (all packages use `"type": "module"`) |
| `dts: true` | Generate `.d.ts` declaration files for TypeScript consumers |
| `clean: true` | Remove `dist/` before each build |
| `sourcemap: true` | Generate source maps for debugging |

### CLI Configuration

The CLI package adds a `banner` option to inject a shebang line, making the output file directly executable:

```typescript
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
```

The `"bin"` field in `packages/cli/package.json` points to `./dist/index.js`, so `npm install -g @lexbuild/cli` makes the `lexbuild` command available globally.

### Build Output

After `pnpm turbo build`, each package's `dist/` directory contains:

```
dist/
├── index.js          # Compiled ESM JavaScript
├── index.js.map      # Source map
├── index.d.ts        # TypeScript declarations
└── index.d.ts.map    # Declaration source map
```

Packages declare their entry points in `package.json` using the `exports` field:

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

## Dev Mode

```json
"dev": {
  "cache": false,
  "persistent": true
}
```

Running `pnpm turbo dev` starts tsup in watch mode (`tsup --watch`) for every package simultaneously. When you save a file in `packages/core/src/`, tsup recompiles core, and the downstream packages pick up the change on their next rebuild cycle.

- **`cache: false`** -- Watch tasks should never be cached; they run continuously.
- **`persistent: true`** -- Tells Turborepo this task does not terminate on its own. Without this flag, Turborepo would wait for the task to exit before considering the pipeline complete.

## Common Build Commands

All commands below are run from the repository root. For a full development setup guide, see [Getting Started](../development/getting-started.md).

### Full Pipeline

```bash
pnpm install              # Install all dependencies
pnpm turbo build          # Build core → usc → cli (cached)
pnpm turbo test           # Run all tests (after builds)
pnpm turbo typecheck      # Type-check all packages
pnpm turbo lint           # Lint all packages (no build needed)
```

### Single-Package Builds

Turborepo's `--filter` flag restricts execution to a specific package and its dependencies:

```bash
# Build only core
pnpm turbo build --filter=@lexbuild/core

# Build usc and its dependency (core)
pnpm turbo build --filter=@lexbuild/usc

# Test only usc (builds core and usc first)
pnpm turbo test --filter=@lexbuild/usc
```

### Watch Mode

```bash
# Watch all packages
pnpm turbo dev
```

### Versioning and Release

Releases use [Changesets](https://github.com/changesets/changesets) with lockstep versioning. The release pipeline builds all packages and publishes them to npm:

```bash
pnpm changeset              # Create a changeset describing your changes
pnpm version-packages       # Apply changesets and bump versions (lockstep)
pnpm release                # Build and publish all packages to npm
```

These commands are defined as root scripts in `package.json`, wrapping the underlying `changeset` CLI.

## Turborepo Caching

Turborepo hashes each task's inputs (source files, dependencies, environment variables) and caches the outputs. On subsequent runs, if the inputs have not changed, the cached output is restored without re-executing the task.

For LexBuild's typical development loop:

- Changing a file in `packages/core/src/` invalidates core's build cache, which transitively invalidates usc and cli builds.
- Changing a file in `packages/usc/src/` invalidates only usc and cli builds. Core's cache is unaffected.
- Changing a file in `packages/cli/src/` invalidates only cli's build.
- Linting caches are independent of build caches (linting has no `dependsOn`).

This caching behavior means that after the first full build, incremental builds during development are fast -- typically under 1 second for a single-package change.
