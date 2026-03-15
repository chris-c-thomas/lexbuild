# Release Process

LexBuild uses [Changesets](https://github.com/changesets/changesets) for versioning and a GitHub Actions publish pipeline for automated npm releases. All three published packages -- `@lexbuild/core`, `@lexbuild/usc`, and `@lexbuild/cli` -- are versioned in lockstep: every release bumps all packages to the same version number. This page covers the changeset workflow, how versions are determined, and what happens in the publish pipeline.

## Lockstep Versioning

All published packages share a single version number. This is configured in `.changeset/config.json` via the `fixed` array:

```json
{
  "fixed": [["@lexbuild/core", "@lexbuild/usc", "@lexbuild/cli"]]
}
```

When any package in the fixed group receives a changeset, all packages in the group are bumped to the same new version. This eliminates version drift between packages and simplifies dependency management for consumers -- `@lexbuild/cli@1.4.2` always depends on `@lexbuild/usc@1.4.2` and `@lexbuild/core@1.4.2`.

The Astro app (`apps/astro/`) is excluded from changesets entirely. It is listed in the `ignore` array in the changeset config and has `"private": true` in its `package.json`.

## Creating a Changeset

When your change affects published package behavior (bug fixes, new features, breaking changes), create a changeset before opening your PR:

```bash
pnpm changeset
```

The interactive prompt asks you to:

1. **Select packages** -- Choose which packages are affected by your change. For most changes, select all three packages (they are versioned together regardless, but the changelog entries will reflect which packages were directly modified).
2. **Choose a bump type** -- `patch`, `minor`, or `major` for each selected package.
3. **Write a summary** -- A short description of the change. This becomes the changelog entry.

The command creates a Markdown file in the `.changeset/` directory (e.g., `.changeset/cool-dogs-dance.md`) with the bump type and summary. Commit this file with your PR.

### Version Bump Types

| Type | When to use | Example |
|------|-------------|---------|
| `patch` | Bug fixes, documentation corrections, internal refactors with no API change | Fix incorrect heading level for `<continuation>` elements |
| `minor` | New features, backward-compatible additions | Add `--include-amendments` CLI flag |
| `major` | Breaking changes to public API or output format | Change frontmatter field names, restructure output directories |

When multiple changesets exist for the same release, the highest bump type wins. If one changeset says `patch` and another says `minor`, the release will be a `minor` bump.

## The Release Flow

The end-to-end release process has seven steps:

1. **Create a changeset** -- A contributor runs `pnpm changeset` and commits the resulting `.changeset/*.md` file alongside their code changes in a PR.

2. **CI validates the PR** -- The CI pipeline runs build, lint, typecheck, and tests on Node.js 22 and 24. All checks must pass before merging.

3. **Merge the PR to `main`** -- The changeset file lands on `main` along with the code change.

4. **Publish pipeline detects unreleased changesets** -- The GitHub Actions publish workflow (`.github/workflows/publish.yml`) runs on every push to `main`. When it finds unreleased changeset files, it runs `pnpm version-packages` (which calls `changeset version`) and opens a release PR.

5. **Release PR accumulates changes** -- The release PR, titled `"chore: version packages"`, contains version bumps in every `package.json`, updated `CHANGELOG.md` files, and the consumed changeset files (deleted from `.changeset/`). If more PRs with changesets merge to `main` before the release PR is merged, the publish pipeline updates the existing release PR to include the new changes.

6. **Merge the release PR** -- A maintainer reviews the planned version bumps and changelog entries, then merges.

7. **Publish pipeline publishes to npm** -- When the release PR merges, the publish pipeline runs again. This time there are no unreleased changesets (they were consumed in step 5), so it runs `pnpm release` (which calls `changeset publish`). All packages are published to npm with provenance attestation.

## Publish Pipeline Details

The publish workflow (`.github/workflows/publish.yml`) uses the [Changesets GitHub Action](https://github.com/changesets/action) with two scripts:

| Script | Root command | What it does |
|--------|-------------|--------------|
| `pnpm version-packages` | `changeset version` | Consumes changeset files, bumps versions, updates changelogs |
| `pnpm release` | `changeset publish` | Publishes all packages to npm |

The workflow runs on `ubuntu-latest` with Node.js 22. It installs dependencies with `pnpm install --frozen-lockfile`, builds all packages with `pnpm turbo build`, then invokes the Changesets action.

### Concurrency

The publish pipeline uses `cancel-in-progress: false`, meaning it never cancels an in-progress run. This prevents a partial publish from being interrupted, which could leave packages in an inconsistent state on npm.

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Automatic; authenticates with GitHub API for creating and updating the release PR |
| `NPM_TOKEN` | Repository secret; authenticates with the npm registry for publishing |

The workflow also requests `id-token: write` permission, which enables npm provenance attestation via OIDC.

## Workspace Protocol and Publish

During development, internal dependencies use pnpm's `workspace:*` protocol:

```json
{
  "dependencies": {
    "@lexbuild/core": "workspace:*"
  }
}
```

When `changeset publish` runs, pnpm automatically replaces `workspace:*` with the concrete version number (e.g., `"1.4.2"`) in the published `package.json`. This means the published packages have fixed version dependencies, while the development workspace always resolves to the local copy.

The `updateInternalDependencies` setting in `.changeset/config.json` is set to `"patch"`, meaning internal dependency version ranges are updated to reflect the new version on every release.

## Changeset Configuration

The full changeset configuration (`.changeset/config.json`):

| Setting | Value | Purpose |
|---------|-------|---------|
| `fixed` | `[["@lexbuild/core", "@lexbuild/usc", "@lexbuild/cli"]]` | Lockstep versioning for all packages |
| `access` | `"public"` | Packages are published with public access on npm |
| `baseBranch` | `"main"` | Changesets are compared against `main` |
| `commit` | `false` | `changeset version` does not auto-commit; the GitHub Action handles commits |
| `changelog` | `@changesets/changelog-github` | Changelog entries include GitHub PR links and author attribution |
| `updateInternalDependencies` | `"patch"` | Internal deps are bumped to match the new version |
| `ignore` | `["astro"]` | The Astro app is excluded from versioning |

## Quick Reference

```bash
# Create a changeset for your changes
pnpm changeset

# Preview what version-packages would do (locally, for debugging)
pnpm version-packages

# Publish packages (normally done by CI, but available locally)
pnpm release

# Build and publish locally (skips CI)
pnpm release:local
```
