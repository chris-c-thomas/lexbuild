# CI/CD

LexBuild uses GitHub Actions for continuous integration and automated npm publishing. Two workflows cover the full lifecycle: CI validates every change, and the Publish workflow automates versioning and package releases.

## CI Pipeline

**File**: `.github/workflows/ci.yml`

**Triggers**: every push to `main` and every pull request targeting `main`.

**Concurrency**: in-progress runs are cancelled when a new commit is pushed to the same branch, keeping the queue clear during active development.

**Job configuration**:

| Setting | Value |
|---------|-------|
| Runner | `ubuntu-latest` |
| Node.js versions | 22, 24 (matrix, `fail-fast: false`) |
| Package manager | pnpm (auto-detected version from `packageManager` field) |
| Dependency install | `pnpm install --frozen-lockfile` |

**Steps** (run in order):

1. **Checkout** -- `actions/checkout@v4`
2. **Install pnpm** -- `pnpm/action-setup@v4` (reads version from `package.json` `packageManager`)
3. **Setup Node.js** -- `actions/setup-node@v4` with pnpm cache enabled
4. **Install dependencies** -- `pnpm install --frozen-lockfile` (fails if lockfile is out of date)
5. **Build** -- `pnpm turbo build` (all four published packages, in dependency order)
6. **Lint** -- `pnpm turbo lint`
7. **Typecheck** -- `pnpm turbo typecheck`
8. **Test** -- `pnpm turbo test`

The matrix tests against Node.js 22 (current LTS) and 24 to catch compatibility issues early. Both versions must pass for a PR to merge.

The Astro web app is excluded from the CI build -- it has no `build` script in its `package.json` (only `build:astro`), so Turborepo's `build` task skips it.

## Publish Pipeline

**File**: `.github/workflows/publish.yml`

**Trigger**: push to `main` only (runs after a PR merges).

**Concurrency**: `cancel-in-progress: false` -- a publish in progress is never interrupted. This prevents partial releases if multiple PRs merge in quick succession.

**Permissions**:

| Permission | Purpose |
|------------|---------|
| `contents: write` | Create and update the release PR |
| `pull-requests: write` | Open PRs via the Changesets action |
| `id-token: write` | npm provenance attestation via OIDC |

**Steps**:

1. **Checkout**, **Install pnpm**, **Setup Node.js** (24), **Install dependencies** -- same as CI
2. **Build** -- `pnpm turbo build`
3. **Create release PR or publish** -- `changesets/action@v1`

### Two-Mode Operation

The Changesets GitHub Action operates in one of two modes on each run:

**Mode 1 -- Unreleased changesets exist**: the action runs `pnpm version-packages` (which calls `changeset version`), bumps versions, updates changelogs, and opens or updates a release PR titled "chore: version packages". This PR accumulates all pending version bumps.

**Mode 2 -- No unreleased changesets** (the release PR was just merged): the action runs `pnpm release` (which calls `changeset publish`), publishing all packages to npm with provenance attestation.

### Required Secrets

| Secret | Source | Purpose |
|--------|--------|---------|
| `GITHUB_TOKEN` | Automatic (GitHub provides) | Authentication for creating the release PR |

npm provenance is enabled via `NPM_CONFIG_PROVENANCE: true` in the environment. The `id-token: write` permission enables OIDC-based provenance attestation, which cryptographically links published packages to their source repository and CI run.

### What Provenance Provides

With `id-token: write` and `NPM_CONFIG_PROVENANCE: true`, published packages include a Sigstore-signed provenance attestation. Consumers can verify:

- Which repository the package was built from
- Which commit and workflow run produced it
- That the package was built in CI, not on a developer machine
