# CI/CD

LexBuild uses two GitHub Actions workflows to ensure code quality and automate releases. The CI pipeline validates every change against multiple Node.js versions before it can be merged. The publish pipeline uses Changesets to manage lockstep versioning across all packages and publish to npm with provenance.

## CI Pipeline

**Workflow file**: `.github/workflows/ci.yml`

The CI pipeline runs on every push to `main` and on every pull request targeting `main`. It uses a matrix strategy to test against Node.js 22 and 24, ensuring compatibility across supported LTS versions.

### Triggers

| Event | Branches |
|-------|----------|
| `push` | `main` |
| `pull_request` | `main` |

### Job: `ci`

Runs on `ubuntu-latest` with `fail-fast: false`, so both Node versions run to completion even if one fails.

**Steps** (in order):

1. **Checkout** — `actions/checkout@v4`
2. **Install pnpm** — `pnpm/action-setup@v4` (version inferred from `packageManager` field in `package.json`)
3. **Setup Node.js** — `actions/setup-node@v4` with pnpm cache enabled
4. **Install dependencies** — `pnpm install --frozen-lockfile` (fails if lockfile is out of date)
5. **Build** — `pnpm turbo build` (builds `core` -> `usc` -> `cli` in dependency order)
6. **Lint** — `pnpm turbo lint` (ESLint with `@typescript-eslint`)
7. **Typecheck** — `pnpm turbo typecheck` (strict TypeScript compilation)
8. **Test** — `pnpm turbo test` (vitest across all packages)

### Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

If a new commit is pushed to the same branch while CI is still running, the in-progress run is cancelled. This avoids wasting runner time on superseded commits during active development.

### Permissions

CI requires only `contents: read`. It does not push commits, create PRs, or publish packages.

### What CI Guarantees

Every pull request must pass the full CI matrix before merging. This means:

- The build succeeds with a clean lockfile on both Node 20 and Node 22
- All packages compile under strict TypeScript settings (`strict: true`, `noUncheckedIndexedAccess: true`)
- No lint violations exist across any package
- All unit and snapshot tests pass

---

## Publish Pipeline

**Workflow file**: `.github/workflows/publish.yml`

The publish pipeline runs only on pushes to `main` (i.e., after a PR is merged). It uses the [Changesets GitHub Action](https://github.com/changesets/action) to either create a release PR or publish packages to npm.

### Triggers

| Event | Branches |
|-------|----------|
| `push` | `main` |

### Job: `publish`

Runs on `ubuntu-latest` with Node.js 22.

**Steps** (in order):

1. **Checkout** — `actions/checkout@v4`
2. **Install pnpm** — `pnpm/action-setup@v4`
3. **Setup Node.js** — `actions/setup-node@v4` with npm registry URL configured for publishing
4. **Upgrade npm** — ensures the latest npm is available for provenance support
5. **Install dependencies** — `pnpm install --frozen-lockfile`
6. **Build** — `pnpm turbo build`
7. **Create release PR or publish** — `changesets/action@v1`

### Changesets Action Behavior

The Changesets action operates in two modes depending on the repository state:

**When unreleased changesets exist**: The action runs `pnpm version-packages` and opens (or updates) a release PR titled `"chore: version packages"`. This PR contains the version bumps and changelog updates for all affected packages. Reviewers can inspect the planned versions before merging.

**When no unreleased changesets exist** (i.e., the release PR was just merged): The action runs `pnpm release`, which builds and publishes all packages to npm. The `NODE_AUTH_TOKEN` secret provides npm authentication, and the `id-token: write` permission enables npm provenance attestation.

### Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false
```

Unlike CI, the publish pipeline does **not** cancel in-progress runs. This prevents a partial publish from being interrupted, which could leave packages in an inconsistent state on npm.

### Permissions

The publish pipeline requires elevated permissions:

| Permission | Purpose |
|------------|---------|
| `contents: write` | Commit version bumps and changelog updates |
| `pull-requests: write` | Create and update the release PR |
| `id-token: write` | npm provenance attestation (OIDC token) |

### Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `GITHUB_TOKEN` | Automatic | Authenticate with GitHub API for PR creation |
| `NPM_TOKEN` | Repository secret | Authenticate with npm registry for publishing |

---

All packages are versioned in lockstep, so every release bumps `@lexbuild/core`, `@lexbuild/usc`, and `@lexbuild/cli` to the same version number.
