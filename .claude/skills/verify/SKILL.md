---
name: verify
description: Verify npm-trust — wraps /solo-npm:verify with the full test suite (lint, typecheck, build, unit tests with 100% coverage, e2e, CLI smoke).
---

# Verify (npm-trust)

Composes /solo-npm:verify with this repo's full verification suite.

## Repo context

- TypeScript 5.8 strict ESM CLI + library
- 100% test coverage threshold (statements/branches/functions/lines)
- E2E tests spawn the built CLI as a child process; require `dist/` to
  be present (i.e., step 3 build must have run first)
- E2E harness uses a fake `npm` binary on `PATH` + `msw` to mock the
  registry — no network calls

## Steps

Run sequentially; halt on first failure.

### 1. Lint

```bash
pnpm lint
```

### 2. Typecheck

```bash
pnpm typecheck
```

### 3. Build

```bash
pnpm build
```

### 4. Unit tests (with coverage)

```bash
pnpm test
```

Must pass with the 100% coverage thresholds enforced in `vitest.config.ts`.

### 5. E2E tests

```bash
pnpm test:e2e
```

### 6. CLI smoke

Final sanity check that the published artifact is wired correctly:

```bash
node bin/npm-trust.js --help
```

Should print usage and exit 0.

## Workflow

Invoke `/solo-npm:verify` for the opinionated baseline. Run the six
steps above sequentially; halt on first failure; surface full output.

## Report

After all steps pass, print a summary:

```
Verification complete:
  ✓ Lint
  ✓ Typecheck
  ✓ Build
  ✓ Unit tests (100% coverage)
  ✓ E2E tests
  ✓ CLI smoke
```
