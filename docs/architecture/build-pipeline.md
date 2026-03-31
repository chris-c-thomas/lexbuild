# Build Pipeline

LexBuild uses Turborepo to orchestrate builds, tests, linting, and type-checking across the monorepo. Turborepo reads the dependency graph from `package.json` files and the task pipeline from `turbo.json`, then executes tasks in the correct order with caching.

## Pipeline Configuration

The pipeline is defined in `turbo.json` at the repository root:

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
      "dependsOn": ["^build"]
    },
    "transit": {
      "dependsOn": ["^transit"]
    },
    "lint": {
      "dependsOn": ["transit"]
    },
    "lint:fix": {
      "dependsOn": ["transit"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build:astro": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": false
    },
    "dev:astro": {
      "cache": false,
      "persistent": true
    }
  }
}
```

## Build Order

The `build` task uses `"dependsOn": ["^build"]`, where `^` means "wait for the same task in upstream workspace dependencies." Turborepo resolves the build order from `workspace:*` dependency declarations in each package's `package.json`:

```
Step 1:  @lexbuild/core        (no internal dependencies)
Step 2:  @lexbuild/usc         (depends on core)     <- parallel
         @lexbuild/ecfr        (depends on core)     <- parallel
Step 3:  @lexbuild/cli         (depends on core, usc, ecfr)
```

Steps 2 and 3 cannot begin until their upstream dependencies have finished building. Packages at the same step run in parallel.

## Task Relationships

### build

`dependsOn: ["^build"]`, `outputs: ["dist/**"]`

Runs `tsup` in each package. Turborepo caches the `dist/` directory. If source files haven't changed since the last build, cached output is restored instead of running `tsup` again.

### typecheck

`dependsOn: ["^build"]`

Runs `tsc --noEmit` in each package. Depends on upstream builds because TypeScript needs `.d.ts` declaration files from dependencies to resolve types. Produces no outputs.

### test

`dependsOn: ["^build"]`

Runs `vitest run` in each package. Depends on upstream builds to ensure declaration files and compiled output from dependencies are available. Tests import from the built `dist/` of upstream packages, so those builds must complete first.

### transit

`dependsOn: ["^transit"]`

An internal synchronization task that propagates through the dependency graph. Used to ensure lint tasks wait for transitive dependency resolution.

### lint / lint:fix

`dependsOn: ["transit"]`

Runs ESLint against source files. The `transit` dependency ensures the dependency graph is resolved before linting begins, which is required for cross-package import resolution.

### dev

`cache: false`, `persistent: true`

Watch mode via `tsup --watch`. Marked `persistent` so Turborepo keeps the process running. Caching is disabled because watch mode produces continuous output.

### build:astro / dev:astro

Separate tasks for the Astro web app, isolated from the main build pipeline. See [The Astro App](#the-astro-app) below.

The following table summarizes all tasks:

| Task | dependsOn | outputs | cache | Notes |
|------|-----------|---------|-------|-------|
| `build` | `["^build"]` | `["dist/**"]` | yes | tsup compilation |
| `typecheck` | `["^build"]` | none | yes | tsc --noEmit |
| `test` | `["^build"]` | none | yes | vitest run |
| `transit` | `["^transit"]` | none | yes | Dependency graph sync |
| `lint` | `["transit"]` | none | yes | ESLint source check |
| `lint:fix` | `["transit"]` | none | yes | ESLint with auto-fix |
| `dev` | none | none | no | tsup --watch (persistent) |
| `build:astro` | `["^build"]` | `["dist/**"]` | no | Astro production build |
| `dev:astro` | none | none | no | Astro dev server (persistent) |

## tsup Configuration

All five packages use tsup for bundling. The library packages (`core`, `usc`, `ecfr`, `fr`) share an identical configuration:

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

The CLI package adds a shebang banner so the built file is directly executable:

```typescript
import { defineConfig } from "tsup";

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

Each build produces four files in `dist/`:

| File | Purpose |
|------|---------|
| `index.js` | ESM bundle |
| `index.js.map` | Source map |
| `index.d.ts` | TypeScript declarations |
| `index.d.ts.map` | Declaration source map |

Packages expose their output through the `exports` field in `package.json`:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

## The Astro App

The Astro app (`apps/astro/`) is deliberately excluded from the default `pnpm turbo build` pipeline. Its `package.json` has no `"build"` script -- only `"build:astro"`. This is intentional: the app requires generated content files (Markdown, nav JSON, highlighted HTML) that are not checked into git. Including it in the default build would cause CI failures.

The Astro app has its own dedicated tasks in `turbo.json`:

```bash
# Production build
pnpm turbo build:astro --filter=@lexbuild/astro

# Development server
pnpm turbo dev:astro --filter=@lexbuild/astro
```

The `build:astro` task has `cache: false` because the app's output depends on content files that exist outside the source tree and are not tracked by Turborepo's input hashing.

The app has no code dependency on `@lexbuild/core`, `@lexbuild/usc`, or `@lexbuild/ecfr`. It consumes their `.md` output as data files, not as imported modules.

## Dev Mode

Running `pnpm turbo dev` starts tsup in watch mode for all library packages simultaneously. File changes trigger incremental rebuilds:

- A change in `packages/core/src/` triggers a core rebuild, which cascades to `usc`, `ecfr`, `fr`, and `cli` as they detect updated output in core's `dist/`.
- A change in `packages/usc/src/` triggers only a `usc` rebuild and downstream `cli` rebuild.

## Turborepo Caching

Turborepo hashes a task's inputs (source files, dependencies, environment) and caches its outputs. On subsequent runs, if the input hash matches a cached entry, the output is restored from cache without executing the task.

Cache invalidation follows the dependency graph:

| Change location | Packages invalidated |
|-----------------|---------------------|
| `packages/core/` | core, usc, ecfr, fr, cli |
| `packages/usc/` | usc, cli |
| `packages/ecfr/` | ecfr, cli |
| `packages/fr/` | fr, cli |
| `packages/cli/` | cli only |

Lint task caches are independent of the build graph. A source change invalidates the lint cache only for the package containing the change, regardless of dependency relationships.

Cache storage is local by default (`.turbo/` directories). Remote caching can be enabled through Turborepo's remote cache configuration if needed.

## Common Build Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm turbo build` | Build all packages in dependency order |
| `pnpm turbo test` | Run all test suites |
| `pnpm turbo typecheck` | Type-check all packages |
| `pnpm turbo lint` | Lint all packages |
| `pnpm turbo dev` | Start watch mode for all packages |
| `pnpm turbo build --filter=@lexbuild/core` | Build a single package |
| `pnpm turbo test --filter=@lexbuild/usc` | Test a single package |
| `pnpm turbo build:astro --filter=@lexbuild/astro` | Build the Astro app |
| `pnpm turbo dev:astro --filter=@lexbuild/astro` | Start the Astro dev server |
