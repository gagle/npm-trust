---
name: release
description: Release npm-trust — wraps /solo-npm:release for this single-package CLI.
---

# Release (npm-trust)

Composes /solo-npm:release with this repo's specifics.

## Repo context

- Workspace: single package at repo root (TypeScript ESM CLI + library)
- Repo slug: `gagle/npm-trust`
- Workflow: `release.yml`
- Verification: `/verify` runs `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e`
- Already trust-bootstrapped (OIDC + provenance configured); doctor's
  `/solo-npm:trust` checks pass without action.

## Workflow

Invoke `/solo-npm:release` for the opinionated three-phase baseline.

## Deviations from the baseline

- Phase A.2 verification includes e2e tests (`pnpm test:e2e`) on top
  of the standard lint/typecheck/build/test. The `/verify` wrapper
  handles this.
