---
name: setup-npm-trust
description: >
  Guided wizard to enable or extend npm OIDC Trusted Publishing across the
  packages in the current repo. Detects the workspace shape via npm-trust-cli,
  shows current trust state, filters to packages still needing setup, walks the
  user through any required manual steps (`npm login`, web 2FA, `npm publish`),
  runs the configuration, and verifies the result.
---

# Setup npm-trust

Interactive wizard for `npm-trust-cli`. The CLI handles detection, filtering,
and per-package configuration. This skill orchestrates the end-to-end flow:
gather inputs → confirm → handle manual steps → execute → verify.

## When to use

- First-time OIDC trust setup for a repo's published packages.
- Incremental setup after publishing one or more new packages.
- Auditing — checking which packages are or aren't trust-configured.

## Prerequisites

`npm-trust-cli` must be reachable. Either install it as a devDependency:

```bash
npm install -D npm-trust-cli
```

Or rely on `npx`, which will fetch the latest version on demand.

Verify:

```bash
npx npm-trust-cli --help 2>&1 | head -1
```

## Phase 1 — Discover

### 1. Detect the workspace shape

Run a dry-run `--auto` to confirm the CLI can identify packages in the current
directory:

```bash
npx npm-trust-cli --auto --dry-run --repo placeholder/x --workflow placeholder.yml 2>&1 | head -10
```

Expected first stdout line:

- `Detected pnpm workspace — found N packages` for repos with `pnpm-workspace.yaml`.
- `Detected npm/yarn workspace — found N packages` for `package.json#workspaces`.
- `Detected single package — found 1 packages` for repos with a single root `package.json`.

If the output is `Error: --auto could not detect…`, **stop** and ask the user
whether to use `--scope <scope>` (org-based registry discovery) or
`--packages <names...>` (explicit list) instead. Use the chosen flag in every
subsequent step.

### 2. Resolve the GitHub repo

```bash
git remote get-url origin
```

Parse `owner/repo` from the URL and confirm with the user.

### 3. Resolve the publish workflow

List candidate workflow files:

```bash
ls .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null
```

If exactly one file exists, suggest it. Otherwise ask the user which workflow
performs the npm publish.

### 4. Show current trust state

```bash
npx npm-trust-cli --auto --list
```

Per-package output: each line shows the package name and either its existing
trust configuration or `(no trust configured)`.

### 5. Identify what still needs work

```bash
npx npm-trust-cli --auto --only-new --list
```

The filter calls `npm trust list` and `npm view` per package and keeps the
ones that lack trust **or** aren't yet published. The result is the precise
working set for this run.

### 6. Confirm with user

Print a summary like:

```
Detected: <source>, <N> packages
Repo:     <owner/repo>
Workflow: <file>

Already configured: <K>
Needs work:         <M>

Plan: configure OIDC trust for <M> packages.
```

Pause and wait for the user to confirm before continuing.

## Phase 2 — Execute

### 7. Pre-auth notice

Tell the user, before any configure call:

> The first `npm trust github` call will open a browser for npm
> authentication. On the npm site, tick **"skip 2FA for the next 5 minutes"**
> so the remaining packages finish without further prompts.

Wait for acknowledgement.

If the user hasn't run `npm login` recently, suggest:

```bash
npm whoami
```

If that fails, ask the user to run `npm login` first, then come back.

### 8. Configure trust

```bash
npx npm-trust-cli --auto --only-new --repo <owner/repo> --workflow <file>
```

The CLI reports per-package status and a final summary
(`Done: X configured, Y already set, Z failed`).

### 9. Handle unpublished packages

If the summary lists failed packages with the suffix `not published yet`:

> The following packages need to be published before OIDC trust can be
> configured for them:
>
> - @scope/new-pkg-a
> - @scope/new-pkg-b
>
> Publish them via your normal release process, then re-run this skill — only
> the now-published packages will be picked up.

Do not retry automatically; publishing is a deliberate user action.

### 10. Verify

```bash
npx npm-trust-cli --auto --list
```

All previously-untrusted-but-published packages should now show trust
information (the workflow file path) instead of `(no trust configured)`.

### 11. Report

Print a final summary:

```
Setup complete.
  Configured this run:  <X>
  Already set:          <Y>
  Pending publish:      <Z>
```

If `Z > 0`, remind the user that those packages still need publishing.

## Notes

- Scope-based mode (`--scope @myorg`) is an alternative to `--auto`. Use it
  when the user explicitly wants to discover via the npm registry rather than
  the workspace filesystem — useful for cross-cutting audits of an entire org.
- `--only-new` is filesystem-scoped: it filters whichever package list was
  produced by the source flag (`--auto`, `--scope`, or `--packages`). Combine
  freely.
- The wizard never runs destructive commands; everything it executes is
  read-only or `npm trust github` (which is idempotent — re-running on an
  already-configured package returns "already configured").
