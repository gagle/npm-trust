# npm-trust — Claude Code context

## Project

`npm-trust` is a TypeScript ESM CLI **and library** that bulk-configures
npm OIDC Trusted Publishing for every package in an npm scope. It auto-discovers
packages via the npm registry, calls `npm trust github` for each, and prints
a summary. `npm trust` uses web-based 2FA only — the first call opens a
browser auth flow; the npm UI's "skip 2FA for 5 minutes" option lets the rest
of the bulk run finish without re-authenticating.

The package ships two surfaces from the same tarball:

- **CLI**: `npx npm-trust ...` (entry: `bin/npm-trust.js` → `dist/cli.js`).
- **Library**: `import { configureTrust, listTrust, discoverPackages, runCli } from 'npm-trust'` (entry: `dist/index.js`).

## Stack

- TypeScript 5.8 strict ESM — `"type": "module"`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`.
- Node.js **>= 24** (`.nvmrc` and `package.json#engines`; runtime guard in `src/cli.ts`).
- npm **>= 11.5.1** (required for `npm trust` — runtime guard).
- Vitest with **100% coverage thresholds** (statements/branches/functions/lines).
- ESLint flat config + Prettier.
- pnpm.

## Layout

```
bin/npm-trust.js          # shebang, imports dist/cli.js
src/
  index.ts                    # PUBLIC LIBRARY — re-exports only, no side effects
  cli.ts                      # CLI bootstrap (main, parseCliArgs, version guards)
  discover.ts                 # npm registry search/pagination
  trust.ts                    # configureTrust / listTrust
  interfaces/
    cli.interface.ts          # CliOptions, TrustResult, TrustSummary
  **/*.spec.ts                # unit tests (co-located, vitest)
e2e/                          # e2e tests — spawn built CLI as child process
.claude/                      # rules, skills, hooks (see below)
```

## Commands

```bash
pnpm lint            # eslint src/
pnpm typecheck       # tsc --noEmit
pnpm build           # tsc -p tsconfig.build.json (excludes *.spec.ts)
pnpm test            # vitest run --coverage (unit, 100% threshold)
pnpm test:e2e        # vitest run --config vitest.e2e.config.ts (against dist/)
pnpm format          # prettier --write .
```

## Conventions

Project-local rules live in `.claude/rules/`:

- `typescript.md` — TS conventions (`Array<T>`, readonly, no any, naming, imports).
- `testing.md` — Vitest patterns + 100% coverage rule.
- `review-criteria.md` — five-axis review checklist.

User-global conventions in `~/.claude/rules/` (TypeScript / Angular / SCSS / a11y) also apply where relevant — but this is a Node CLI, so the Angular/SCSS/a11y rules are not used.

## Skills

`.claude/skills/`:

- `commit` — git workflow (stage by name, conventional commits, squash, push).
- `verify` — lint → typecheck → build → test → test:e2e → CLI smoke. Run before marking work complete.
- `release` — three-phase tag-triggered release wrapper that invokes `/solo-npm:release` from the [`gagle/solo-npm`](https://github.com/gagle/solo-npm) marketplace plugin; bumps version, generates changelog, tags, watches CI, verifies provenance.
- `review` — five-axis principal review.
- `testing` — Vitest test templates.
- `security-audit`, `debug-issue`, `explore-codebase`, `refactor-safely` — generic.

As of v0.9.0, `npm-trust` is a **pure CLI**: no `.claude-plugin/`, no
bundled `skills/setup/`. The OIDC trust wizard skill has moved into the
`solo-npm` marketplace plugin and is invoked as `/solo-npm:trust`.

## MCP: code-review-graph

This workspace has the `code-review-graph` MCP server available. Per the project instructions in `~/projects/CLAUDE.md`, **prefer graph tools (`semantic_search_nodes`, `query_graph`, `get_impact_radius`, `detect_changes`, `get_review_context`) over `Grep`/`Glob`/`Read`** for codebase exploration and review. Fall back to file scanning only when the graph doesn't cover what's needed.

The graph auto-updates via `PostToolUse` hooks; run `mcp__code-review-graph__build_or_update_graph_tool` manually after `git pull`/`rebase`/`merge` (the `graph-update-check.sh` hook will remind you).

## Hooks

`.claude/settings.json` registers:

- `auto-format.sh` on `Edit`/`Write` — runs ESLint `--fix` + Prettier `--write` on the changed file.
- `graph-update-check.sh` on `Bash` — alerts when a git operation may have brought in external changes.

## Pre-publish

For a normal release, invoke `/release` — it runs Phase A pre-flight (`/verify` + `npm-trust --doctor`), shows the plan with one `AskUserQuestion` approval, then commits / tags / watches CI / verifies provenance on the registry.

The package is past first-publish (currently at v0.8.0 with OIDC trust configured). For a hypothetical fresh repo doing its first publish, see the "First publish (chicken-and-egg)" section in [`README.md`](README.md) — the classic-publish step is repo-author-driven; the trust-setup half is owned by the `/solo-npm:trust` skill in the [solo-npm marketplace plugin](https://github.com/gagle/solo-npm).

## Important guardrails

- **Don't add the `.js` extension** to TS imports (`import './foo'` not `'./foo.js'`) — `verbatimModuleSyntax` + Node16 module resolution handles it. Wait — actually this codebase **does** use `.js` extensions in imports (see `discover.ts`, `trust.ts`). User-global TS rule says no `.js`, but Node16 ESM **requires** them at runtime. **For this repo, keep `.js` extensions in source imports** — the runtime resolution overrides the user-global preference.
- **Don't expose internals** — only the surface listed under "Project" should be exported from `src/index.ts`. Helpers stay unexported.
- **Don't break the CLI surface** — `bin/npm-trust.js` must remain working. Test via `pnpm test:e2e`.
