# Changelog

## [0.10.0](https://github.com/gagle/npm-trust/compare/v0.9.1...v0.10.0) (2026-05-07)

Minor release that adds seven integration improvements aimed at
downstream consumers (notably the [`gagle/solo-npm`](https://github.com/gagle/solo-npm)
marketplace plugin's `/trust`, `/release`, `/audit`, and `/status`
skills). The CLI surface gains three new flags and richer JSON
schemas; the new [`docs/cli-api.md`](./docs/cli-api.md) documents the
public contract that downstreams pin to.

### Added

- **Structured exit codes** (`EXIT.*`). New constants for the most
  common failure modes — `CONFIGURATION_ERROR=10`, `AUTH_FAILURE=20`,
  `OTP_REQUIRED=21`, `WORKSPACE_DETECTION_FAILED=30`,
  `REGISTRY_UNREACHABLE=40`, `WEB_2FA_TIMEOUT=50`,
  `PARTIAL_FAILURE=60`. Exported from the public API as
  `EXIT` + `ExitCode` type.
- **`--emit-workflow`** — prints the canonical OIDC `release.yml`
  template to stdout. Consumers redirect to
  `.github/workflows/release.yml`.
- **`--validate-only`** — fast read-only pre-flight that runs the
  workflow check, repo slug parse, and `npm whoami` only. No
  per-package registry calls. Mutually exclusive with `--doctor`
  (returns `CONFIGURATION_ERROR` if both are passed). Useful for the
  cache-aware delta detection step in `/release`.
- **`--verify-provenance`** — bulk-queries provenance attestations
  for the discovered/named packages in one command. Saves N
  individual `npm view <pkg> dist.attestations` calls in `/audit`
  and `/status`.
- **Richer `--doctor --json` schema** (`schemaVersion` 1 → 2):
  - `workflowSnapshot?: WorkflowSnapshotReport` — populated when
    `--workflow` matches a known file. Includes a sha256 `fileHash`
    so consumers can detect drift.
  - `packages[].latestVersion` and `packages[].lastSuccessfulPublish`
    — derived from `npm view <pkg> version time --json` per package
    (run in parallel).
  - `packages[].perPackageIssueCodes` — issue codes filtered to that
    specific package, so consumers can render package-scoped warnings
    without re-walking the global issues array.
- **`--json` on `--list` and configure**. Both paths now accept
  `--json` and emit a single buffered JSON blob at the end of the
  run instead of per-package text. New `ListReport` and
  `ConfigureReport` schemas; `dry_run` is now a first-class
  configure result alongside `configured` / `already` /
  `not_published` / `auth_failed` / `error`.
- **Public CLI contract docs** — [`docs/cli-api.md`](./docs/cli-api.md)
  documents stability levels, every flag, all five JSON schemas,
  the Node library surface, exit codes, and the migration guide.
  Future-work and explicit-non-goals sections make the project's
  roadmap visible.
- **Library exports**: `runValidate`, `collectValidateReport`,
  `formatValidateReportJson`, `formatValidateReportHuman`,
  `verifyProvenance`, `formatVerifyProvenanceJson`,
  `formatVerifyProvenanceHuman`, `readWorkflowSnapshotReport`, and
  the `EXIT` / `ExitCode` constants. New types:
  `ValidateReport`, `VerifyProvenanceReport`,
  `WorkflowSnapshotReport`, `ProvenanceEntry`, `ListReport`,
  `ListReportEntry`, `ConfigureReport`, `ConfigureReportEntry`,
  `ConfigureEntryResult`.

### Fixed

- Workflow regex (`hasIdTokenWrite`) now accepts an optional
  trailing `# comment` on the `id-token: write` line. Pre-0.10.0
  the regex was strict-EOL and missed any annotated workflow line —
  this affected the `--emit-workflow` template, which has a comment
  on that line, and any user workflow with similar annotations.

### Migration notes

- **Configure-path exit code change**: configure now returns `60`
  (`PARTIAL_FAILURE`) instead of `1` when at least one package fails.
  Tools using `if (rc !== 0)` are unaffected. Tools that want to
  distinguish "configuration error" from "package failure" can now
  branch on the structured codes.
- **`DoctorReport.schemaVersion`**: bumped from `1` to `2`. Consumers
  that hardcode `schemaVersion === 1` should switch to
  `schemaVersion >= 1`. New fields are additive and safely accessible
  via optional chaining.
- **No CLI removals**. Every flag from `0.9.1` is still present and
  shape-stable.

## [0.9.1](https://github.com/gagle/npm-trust/compare/v0.9.0...v0.9.1) (2026-05-07)

Patch release. No source / CLI surface changes — bumps to ship the polish accumulated since v0.9.0 + verifies CLI flag compatibility with the [`gagle/solo-npm`](https://github.com/gagle/solo-npm) v0.16.0 pin (which moves from `^0.4` to `^0.9`).

### Changes

- **Built with AI badge** added to `README.md` (commit `a8587d3`).
- **Adopted `solo-npm` marketplace plugin via thin wrappers** in dogfood skills (commit `b56bd97`):
  - `.claude/skills/release/SKILL.md` — was a 341-line standalone skill; now a 27-line thin wrapper that invokes `/solo-npm:release`. The `release-solo-npm` skill was removed entirely.
  - `.claude/skills/verify/SKILL.md` — refreshed to match solo-npm's wrapper convention.
  - `.claude/settings.json` — declares the marketplace + plugin install.

### Compatibility note for `solo-npm` consumers

Every CLI flag that the `/solo-npm:trust` skill body exercises (`--auto`, `--doctor`, `--json`, `--list`, `--only-new`, `--dry-run`, `--repo`, `--workflow`, `--scope`, `--packages`) is present and shape-stable in `0.9.1`. solo-npm's `^0.9` pin is safe.

## [0.9.0](https://github.com/gagle/npm-trust/compare/v0.8.0...v0.9.0) (2026-05-04)

### Refocus on pure CLI — Breaking Changes

`npm-trust` shrinks back to a pure CLI tool. The Claude Code plugin facet
and the bundled `setup` skill have moved out, into the
[`gagle/solo-npm`](https://github.com/gagle/solo-npm) marketplace plugin.

The CLI tool and its setup wizard skill have different lifecycles. The
CLI evolves around npm's APIs; the wizard evolves around AI-driven
solo-dev workflows. Splitting them gives clean responsibilities —
npm-trust ships a CLI usable by anyone (with or without Claude Code),
and solo-npm bundles the AI workflows that orchestrate it.

- **Removed `.claude-plugin/plugin.json`** — npm-trust is no longer a
  Claude Code marketplace plugin.
- **Removed `skills/setup/SKILL.md`** — the OIDC setup wizard skill has
  moved to `solo-npm` and is renamed `trust`. Install solo-npm and
  invoke `/solo-npm:trust`.
- **Removed `--init-skill <name>` CLI flag.** Stale scripts that called
  `pnpm exec npm-trust --init-skill setup` will get "unknown flag".

### Migration

If you previously ran `pnpm exec npm-trust --init-skill setup`:

1. Add to your `.claude/settings.json`:
   ```json
   {
     "extraKnownMarketplaces": {
       "gllamas-skills": {
         "source": { "source": "github", "repo": "gagle/solo-npm" }
       }
     },
     "enabledPlugins": {
       "solo-npm@gllamas-skills": true
     }
   }
   ```
2. Accept the install prompt on folder trust.
3. Invoke as `/solo-npm:trust`.

The CLI itself (`--auto`, `--doctor`, `--scope`, `--packages`, `--list`,
`--workflow`, `--repo`, `--dry-run`, `--only-new`, `--json`) is unchanged.

## [0.8.0](https://github.com/gagle/npm-trust/compare/v0.7.0...v0.8.0) (2026-05-04)

### Features

- **`npm-trust` is now distributable as a Claude Code plugin** in addition to the existing npm package distribution. New file `.claude-plugin/plugin.json`. Install via `/plugin marketplace add gagle/solo-npm` then `/plugin install npm-trust@gllamas-skills`. The setup skill is then invocable as `/npm-trust:setup` without needing to copy the skill file into the consumer repo. The CLI's `--init-skill setup` flow continues to work for repos that want the skill content tracked in their git history.

### Breaking Changes

- bundled skill **renamed `npm-trust-setup` → `setup`** (folder, frontmatter `name`, CLI flag value, slash invocation). The Claude Code plugin namespace prefix produces `/npm-trust:setup` automatically (matching the addyosmani/agent-skills convention).
- `--init-skill <name>` flag value changed: `npm-trust-setup` → `setup`. Migration:
  ```bash
  # before
  pnpm exec npm-trust --init-skill npm-trust-setup
  # after
  pnpm exec npm-trust --init-skill setup
  ```
- Repos with a committed `.claude/skills/npm-trust-setup/` folder should:
  ```bash
  git mv .claude/skills/npm-trust-setup .claude/skills/setup
  # update SKILL.md frontmatter `name: npm-trust-setup` → `name: setup`
  # update body slash refs `/npm-trust-setup` → `/npm-trust:setup`
  ```

## [0.7.0](https://github.com/gagle/npm-trust/compare/v0.6.1...v0.7.0) (2026-05-04)

### Migration

The bundled skill rename has a single user-facing breakage: anyone who currently runs

```bash
pnpm exec npm-trust --init-skill setup-npm-trust
```

needs to use the new value:

```bash
pnpm exec npm-trust --init-skill npm-trust-setup
```

Existing `.claude/skills/setup-npm-trust/` directories on disk continue to work as Claude Code skills (the slash command is driven by frontmatter, not folder name) — but for consistency, rename the local folder to `.claude/skills/npm-trust-setup/` and update the SKILL.md frontmatter `name` to `npm-trust-setup`.

### Features

- new doctor checks driven by the bundled skill rename + private-registry support: `WORKFLOW_AUTH_MISMATCH` (workflow `id-token: write` vs custom `publishConfig.registry`, or vice-versa), `NPMRC_REGISTRY_DIVERGES` (`.npmrc` registry / scope mapping disagrees with `publishConfig.registry`), `NPMRC_LITERAL_TOKEN` (literal `_authToken` value committed to `.npmrc`), `WORKFLOW_MISSING_AUTH_SECRET` (private-registry workflow surfaces the GitHub Actions secret name `NODE_AUTH_TOKEN: ${{ secrets.<NAME> }}` for the user to verify). New parsers in `src/npmrc.ts` and `src/workflow.ts` (zero runtime deps; hand-rolled regex).

### Breaking Changes

- bundled skill renamed `setup-npm-trust` → `npm-trust-setup` (namespace-first, matching the `npm-trust:setup` script convention). Folder, frontmatter `name`, slash command, and `--init-skill <name>` flag value all rename together.

### Refactor

- delete `docs/bootstrap.md`. The "First publish (chicken-and-egg)" content moved to `README.md`. The "custom vs public registries" trade-off content was relocated earlier into the `release-solo-npm` marketplace plugin's README. The bootstrap-CLI vision is dropped entirely (the marketplace plugin's `/init-solo-npm` skill, when it ships, replaces that vision).
- `package.json#engines.node` normalized to `>=24`. `release.yml` switched from hardcoded `node-version: 24` to `node-version-file: .nvmrc` for DRY.

## [0.6.1](https://github.com/gagle/npm-trust/compare/v0.6.0...v0.6.1) (2026-05-03)

**First proper provenance-attested release under the `npm-trust` name.**

v0.6.0 was a bootstrap classic publish (no provenance) because OIDC trust
needed the package to exist on the registry first. Trust was configured
immediately after, and v0.6.1 onward ships from tag-triggered CI with
SLSA provenance — like every other release in the v0.x line.

### Refactor / Docs

- align `setup-npm-trust` skill mentions and `docs/bootstrap.md`
  references with the renamed marketplace plugin (`solo-npm-release-skill`
  → `release-solo-npm`); slash commands updated to `/release-solo-npm`
  and `/verify-solo-npm` ([8c7c228](https://github.com/gagle/npm-trust/commit/8c7c228))

## [0.6.0](https://github.com/gagle/npm-trust/compare/v0.5.0...v0.6.0) (2026-05-03)

### Renamed: `npm-trust-cli` → `npm-trust`

This package was renamed from `npm-trust-cli` to `npm-trust`. The new name aligns with modern Node CLI naming (no `-cli` suffix; cf. `eslint`, `prettier`, `vitest`, `tsdown`). The hyphen visually distinguishes the wrapper from the underlying `npm trust github` subcommand.

**To migrate**:

```bash
pnpm remove npm-trust-cli
pnpm add -D npm-trust
```

Update any script bodies from `npm-trust-cli ...` to `npm-trust ...`. The bin name is now `npm-trust`. The library import is `import { configureTrust, ... } from 'npm-trust'`.

The legacy `npm-trust-cli@^0.5.0` package is deprecated with a pointer to this package.

### Breaking Changes

- `--init-skill` now requires a skill name as a positional value: `npm-trust --init-skill setup-npm-trust`. The bare `--init-skill` form (which used to install `setup-npm-trust` by default) now exits 1 with a list of available skills. Clean break, no fallback.

### Features

- new doctor check: `REGISTRY_PROVENANCE_CONFLICT` (warn-level) fires when `package.json#publishConfig.registry` points at a non-public-npm URL **and** `publishConfig.provenance` is `true`. The combo can't work — Sigstore signing only operates on the public npm registry. Doctor surfaces a clear remedy: either remove `provenance: true` or change `registry` back to public npm.
- `package.json#publishConfig` is now the canonical source of `access` / `provenance` settings (set to `{ access: "public", provenance: true }`). The CI workflow's publish step is reduced to `pnpm publish --no-git-checks` since pnpm reads `publishConfig` automatically — no redundant `--access`/`--provenance` flags.

### Refactor

- bundled `setup-npm-trust` skill, README, CLAUDE.md, all docs and source files updated to reflect the new package name and the new bin shim path (`bin/npm-trust.js`).
- env vars renamed: `NPM_TRUST_CLI_NPM` → `NPM_TRUST_NPM`, `NPM_TRUST_CLI_REGISTRY` → `NPM_TRUST_REGISTRY`.

### Note on this release

v0.6.0 is a **bootstrap publish** under the new package name. Because OIDC Trusted Publishing requires the package to exist before trust can be configured, this release was published locally via classic 2FA without SLSA provenance. Trust was configured immediately after, so **v0.6.1 onward ships from tag-triggered CI with provenance** like every other release.

## [0.5.0](https://github.com/gagle/npm-trust-cli/compare/v0.4.0...v0.5.0) (2026-04-30)

### Features

- bundled `setup-npm-trust` skill: convert four interactive text prompts to `AskUserQuestion` tool calls (source-flag fallback when `--auto` can't detect the workspace, GitHub repo confirmation, workflow disambiguation, and the Phase 2 proceed gate). Free-text "yes/no?" prompts were too easy to miss against surrounding agent output — the structured selector renders as a clearly-labeled chip and is unmissable. Add a "Recommended conventions" section documenting the `AskUserQuestion`-only rule and the preferred `npm-trust:setup` npm-script naming (namespace before verb) over the older `setup:npm-trust` ordering ([651736f](https://github.com/gagle/npm-trust-cli/commit/651736f))

## [0.4.0](https://github.com/gagle/npm-trust-cli/compare/v0.3.0...v0.4.0) (2026-04-30)

### Features

- add `--doctor` flag emitting a structured DoctorReport (cli, runtime, auth, workspace, repo, workflows, packages, issues, summary). `--json` produces machine-parseable output for agents and CI gates. Exit code is 0 when no `fail`-severity issues exist, 1 otherwise. Stable issue codes (NODE_TOO_OLD, AUTH_NOT_LOGGED_IN, WORKSPACE_*, REPO_*, WORKFLOWS_*, PACKAGE_*, REGISTRY_UNREACHABLE, DOCTOR_FLAG_IGNORED) let agents branch on the report without parsing prose. PACKAGE_TRUST_DISCREPANCY surfaces the npm trust list / SLSA provenance gap explicitly. `--doctor` short-circuits before the Node/npm version checks so the CLI can still produce a useful report on under-provisioned environments ([b7d525c](https://github.com/gagle/npm-trust-cli/commit/b7d525c))
- add `checkPackageStatusesAsync` export with bounded concurrency (8 by default). Collapses `npm view name` + `npm view dist.attestations.url` into a single `npm view <pkg> dist --json` call, halving the per-package spawn count. Pushes 50-package monorepos from minutes to seconds. The sync `checkPackageStatuses` keeps the same shape for backward compatibility ([b7d525c](https://github.com/gagle/npm-trust-cli/commit/b7d525c))
- bundled `setup-npm-trust` skill now opens Phase 1 with `<CLI> --doctor --json` when the resolved CLI supports it; falls back to the multi-step probe for v0.2.0/v0.3.0 CLIs. The agent gets all of Phase 1's info in a single call + JSON parse, and consumers branch on stable issue codes ([b7d525c](https://github.com/gagle/npm-trust-cli/commit/b7d525c))

## [0.3.0](https://github.com/gagle/npm-trust-cli/compare/v0.2.0...v0.3.0) (2026-04-30)

### Features

- cross-check OIDC trust state against the registry's SLSA provenance attestation. `checkPackageStatuses` now returns `hasProvenance: boolean` per package, and `findUnconfiguredPackages` keeps a package only when it has neither an explicit trust record nor a provenance attestation. Catches the common case where Trusted Publishing was configured via npm's web UI rather than `npm trust github`, where `npm trust list` reports empty but OIDC publishing actually works ([58333bd](https://github.com/gagle/npm-trust-cli/commit/58333bd))
- harden the bundled `setup-npm-trust` skill: introduce a `<CLI>` placeholder + Pre-flight section that resolves the right invocation in priority order (source checkout → devDep → global → `npx -y npm-trust-cli@latest`); add a version-compat gate so an old cached install fails loudly at the top instead of three steps in; promote `npm whoami` from a soft suggestion to a hard STOP gate before the configure step; add a pre-flight `--dry-run` step before the actual configure call so typos in `--repo`/`--workflow` surface without burning a 2FA round-trip ([58333bd](https://github.com/gagle/npm-trust-cli/commit/58333bd))

## [0.2.0](https://github.com/gagle/npm-trust-cli/compare/v0.1.0...v0.2.0) (2026-04-30)

### Features

- infer common scope from package names and rewrite README around five concrete use cases (first-time org setup, incremental new packages, single package, monorepo, audit) ([ac4a8ba](https://github.com/gagle/npm-trust-cli/commit/ac4a8ba))
- add `--auto` flag with filesystem detection: `pnpm-workspace.yaml` → `package.json#workspaces` → single root `package.json`. Hand-rolled YAML reader keeps zero runtime dependencies. New exports `discoverFromCwd`, `parsePnpmWorkspacePackages`, and `DiscoveredWorkspace` / `WorkspaceSource` types ([53603fb](https://github.com/gagle/npm-trust-cli/commit/53603fb))
- add `--only-new` filter for incremental setup. New `src/diff.ts` module exposes `checkPackageStatuses` (rich per-package status: `trustConfigured`, `published`) and `findUnconfiguredPackages` (CLI-side filter). Both calls run `npm trust list` and `npm view` per package ([f9fcfdf](https://github.com/gagle/npm-trust-cli/commit/f9fcfdf))
- bundle the `setup-npm-trust` Claude Code skill at `skills/setup-npm-trust/SKILL.md` and add the `--init-skill` flag, which scaffolds the skill into the consumer's `./.claude/skills/`. `runCli` reorders so `--help` and `--init-skill` short-circuit before the Node/npm version checks. README adds a "Use from a Claude Code agent" section. The `skills/` folder is included in the npm tarball via `package.json#files` ([abe98d5](https://github.com/gagle/npm-trust-cli/commit/abe98d5))

### Refactor

- harden `--auto` and `--only-new` against round-1 review feedback: pnpm-workspace negation patterns are honored as literal-path exclusions, the YAML reader handles inline-flow form (`packages: [a, b]`), `expandWorkspaceGlobs` consolidates dedup into a single ordered `Set`, and `findUnconfiguredPackages` collapses to `filter().map()` ([30013f6](https://github.com/gagle/npm-trust-cli/commit/30013f6))
- rework `--init-skill` around `copyFile(..., COPYFILE_EXCL)` for atomic existence checking. Eliminates the TOCTOU window in the previous `access()` precheck and surfaces real errnos (EACCES/EPERM/EROFS) instead of silently treating them as "target already exists". Adds `isFsErrorWithCode` helper; tests cover EEXIST, ENOENT, the unexpected-errno rethrow, and the non-Error rejection branch ([360ce2e](https://github.com/gagle/npm-trust-cli/commit/360ce2e))

## [0.1.0](https://github.com/gagle/npm-trust-cli/compare/v0.0.0...v0.1.0) (2026-04-29)

### Breaking Changes

- trim public API: drop `CliError`, `checkNodeVersion`, `checkNpmVersion`, `parseCliArgs`, `printUsage`, and `ParseCliArgsResult` from `src/index.ts` — only `discoverPackages`, `configureTrust`, `listTrust`, `runCli` (plus their input/output types) remain on the library surface ([0e3b56e](https://github.com/gagle/npm-trust-cli/commit/0e3b56e))
- remove the `--otp` CLI flag and all OTP routing — `npm trust` uses web-based 2FA only and never consumed `--otp` or `NPM_CONFIG_OTP`. Rely on the npm UI's "skip 2FA for 5 minutes" toggle for bulk runs ([fc5b0fe](https://github.com/gagle/npm-trust-cli/commit/fc5b0fe))
- drop `otp` from `ConfigureTrustOptions` (programmatic API). Earlier route via `process.env.NPM_CONFIG_OTP`; now there's no OTP path at all ([b171c9a](https://github.com/gagle/npm-trust-cli/commit/b171c9a))

### Features

- ci: tag-triggered release workflow (`.github/workflows/release.yml`) publishes with `--provenance` from GitHub Actions OIDC ([9b83674](https://github.com/gagle/npm-trust-cli/commit/9b83674))

### Refactor

- introduce `RuntimeLogger` (Logger + error) so the library and CLI vocabularies don't carry an inline anonymous shape; promote `MIN_NPM_VERSION` constant; collapse `classifyCaptured` to one line; name the internal `ClassifiedRun` / `FailureKind` types ([0e3b56e](https://github.com/gagle/npm-trust-cli/commit/0e3b56e))
- `validatePackages` rejects names that don't match npm's published-package format before they're spawned (defense in depth — argv-mode spawn is already shell-safe, but a leading-dash name could be interpreted as an npm flag) ([5c3b9d2](https://github.com/gagle/npm-trust-cli/commit/5c3b9d2))
- document the `trustPackage → handleAuthRetry` recursion-stop guard; drop redundant `: unknown` on catch ([d637d41](https://github.com/gagle/npm-trust-cli/commit/d637d41))

### Chores

- cover root config files (`vitest.config.ts`, `vitest.e2e.config.ts`, `eslint.config.js`, `bin/*.js`) in tsconfig + eslint so the IDE's project service stops flagging them ([255f12c](https://github.com/gagle/npm-trust-cli/commit/255f12c))
- remove obsolete `.claude/hooks/graph-update-check.sh` ([ce32d8c](https://github.com/gagle/npm-trust-cli/commit/ce32d8c))

## [0.0.0](https://github.com/gagle/npm-trust-cli/releases/tag/v0.0.0) (2026-04-29)

Initial release.
