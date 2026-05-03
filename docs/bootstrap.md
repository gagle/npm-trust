# Bootstrap & release architecture for AI-driven solo dev

This doc captures the opinionated architecture that `npm-trust` is part
of: a release workflow built for **solo developers** (or small groups of
LLM agents) shipping AI-generated code to npm, with **PRs disabled** in
their repos.

The doc has two purposes:

1. **Spec the multi-repo architecture** — what each repo is for, how they
   compose, where the seams are.
2. **Annotate everything release-related** — the release skill, the
   verify skill, the chicken-and-egg first publish, custom-registry
   handling, monorepo handling. All in one place.

It also sketches a future bootstrap CLI as a vision spec — that piece is
**not built**; this doc is its design brief.

---

## 1. The vision

You're one human (or a small group of LLM agents) shipping an npm
package. **PRs are disabled** in your repo (issue/discussion-only
contribution model — see [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the
canonical example). There's no committee to review code, no second pair
of human eyes.

You want releases that are:

- **Boring**: tested, typed, provenanced, every time. No exceptions.
- **One-touch**: not a 15-step runbook, not a commit-message lottery.
- **Provable**: SLSA attestations on every tarball, traceable back to
  git.
- **Fast**: when you're moving, friction kills momentum, but it
  shouldn't cost correctness.

Existing release tooling is built for teams. PR-based workflows,
multi-stage approvals, complex changelog negotiation. In a solo or
agent-driven context, that overhead becomes friction. Friction makes you
skip steps. Skipped steps make unsigned, unverified, opaque releases.

The architecture below replaces team-style review with **automated
discipline + provenance**.

---

## 2. The multi-repo architecture

Three repos, each owning exactly one concern:

```
┌────────────────────────────┐  ┌─────────────────────────────────┐
│  gagle/npm-trust           │  │  gagle/release-solo-npm   │
│  ─────────────────────     │  │  ─────────────────────────────  │
│  Trust + OIDC infra        │  │  Claude Code marketplace plugin │
│  • CLI: --doctor, --auto   │  │  • /release-solo-npm skill (3 phases)    │
│  • Bundled setup-npm-trust │  │  • /verify-solo-npm skill (lint+test+    │
│    skill                   │  │    build, customizable)         │
│  • Library API             │  │  • Distributed via /plugin      │
└────────────────────────────┘  └─────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Future: bootstrap CLI (NOT BUILT — see §9)                     │
│  ───────────────────────────────────────────                    │
│  Scaffolds a fresh AI-driven repo: CLAUDE.md, .claude/,         │
│  .github/workflows/, CONTRIBUTING.md, package.json, etc.        │
│  Pulls release + verify from gagle/release-solo-npm.      │
│  Pulls trust setup from gagle/npm-trust.                        │
└─────────────────────────────────────────────────────────────────┘
```

### Why three repos and not one

- **Trust** is npm-OIDC-specific. Its consumers don't all want the
  release skill.
- **Release** is broader (commit → tag → CI publish). Its consumers
  don't all need OIDC trust setup (private registries, for example).
- **Bootstrap** is one-shot. Its consumers run it once and never again.

Each repo can release on its own cadence, version independently, and
expose its own API (CLI / library / marketplace plugin).

### Why a Claude Code marketplace plugin for release

Three options were considered for distributing the release skill:

| Option | Verdict |
|---|---|
| Bundle inside `npm-trust` as a second skill | Rejected — `npm-trust` is *trust* infra. Mission creep. |
| Copy-paste from a GitHub repo | Rejected — no versioning, no update path. |
| Claude Code marketplace plugin | ✓ Native distribution, versioned, `/plugin install` updates |

Claude Code marketplaces are GitHub repos with `.claude-plugin/` manifests
(`marketplace.json` + `plugin.json`). Skills auto-discovered from
`skills/<name>/SKILL.md`. Install is two lines:

```
/plugin marketplace add gagle/release-solo-npm
/plugin install release-solo-npm@gllamas-skills
```

---

## 3. The release skill — full lifecycle

The `/release-solo-npm` skill (from `release-solo-npm`) drives a release
through **three phases** with **one human checkpoint**.

### Phase A — Pre-flight (silent if green)

1. **Working tree clean** — `git status --porcelain` empty, else STOP.
2. **`/verify-solo-npm`** — lint + test + build. The skill defers to the user's
   `/verify-solo-npm` skill (also from the marketplace plugin), which can be
   customized per-repo.
3. **`npm-trust --doctor --json`** — checks Node version, npm version,
   workspace detection, repo remote, workflow file, package publication,
   trust state, and `publishConfig` sanity (including the new
   `REGISTRY_PROVENANCE_CONFLICT` check).

Phase A passes silently for the typical case. Failures STOP and surface
the underlying error.

### Phase B — Plan (one approval gate)

1. **Find latest tag** — `git tag --list 'v*' --sort=-v:refname | head -1`.
2. **Detect version mode**:
   - **Stable** — current version matches `^\d+\.\d+\.\d+$`
   - **Pre-release** — current version matches `^\d+\.\d+\.\d+-[a-z]+\.\d+$`
3. **Collect commits** since latest tag. Parse as conventional commits.
   Group: Breaking, Features, Fixes, Performance, Reverts, Other.
4. **Decide bump (stable)** — Breaking → major; Features → minor;
   Fix/Perf/Revert → patch; Only Other → STOP, nothing to release.
5. **Render summary + `AskUserQuestion`** — the **only** human checkpoint.
   The selector renders as a clearly-labeled chip (not a free-text
   prompt). Stable mode options:
   - `Proceed with v{NEXT}`
   - `Override version` (free-form; accepts pre-release strings)
   - `Edit changelog`
   - `Abort`
   Pre-release mode swaps in `Bump pre-release counter` and `Promote to
   stable`.

### Phase C — Execute (silent through verification)

After approval at B.5, runs end-to-end:

1. Apply CHANGELOG entry + bump `package.json#version` (and
   `packages/*/package.json#version` if monorepo).
2. Commit `chore: release v${NEXT_VERSION}`.
3. Push (commit only, no tag yet).
4. Final `/verify-solo-npm` against the bumped state.
5. Tag `v${NEXT_VERSION}` and push the tag — **this triggers the
   release workflow**.
6. `gh run watch --exit-status` until CI completes.
7. Verify on the registry (`npm view <PACKAGE>@<VERSION> version` and
   `dist.attestations` for SLSA provenance).
8. Print final notification.

Halt on first failure. Recovery guidance per failure mode is in the
skill's "Failure modes and recovery" table.

### Why one approval and not zero

A fully-zero-approval flow is technically possible: `/release-solo-npm` could
auto-confirm every plan. The user rejected this — the **single approval
gate is the security boundary**. The agent computes a plan; a human
ratifies before any tag is pushed. This is the smallest possible review
surface that still keeps a human in the loop.

The structured `AskUserQuestion` selector (instead of a free-text
prompt) is unmissable, unmistakable. Free-text "yes/no?" lines blend
into surrounding agent output and get skipped accidentally — that's
exactly the failure mode this design guards against.

---

## 4. The verify skill

`/verify-solo-npm` is a separate skill (also shipped by `release-solo-npm`)
that runs the verification gates for the repo.

**Default body**: lint + test + build (with placeholders for the actual
commands).

**The point of separateness**: verification is the *per-repo
customization point*. Different stacks need different commands (e2e,
coverage thresholds, typecheck, license audit, bundle size limits). By
making it its own skill, `/release-solo-npm` doesn't need to know what
"verification" means for any specific stack — it just calls `/verify-solo-npm`
and trusts the result.

The user edits `.claude/skills/verify-solo-npm/SKILL.md` after install to fit
their stack. `/release-solo-npm` Phase A.2 and Phase C.4 both invoke it.

If `/verify-solo-npm` isn't installed (e.g., user only installed `/release-solo-npm`),
the release skill falls back to running `<LINT_CMD> && <TEST_CMD> &&
<BUILD_CMD>` inline using the placeholder values.

---

## 5. First publish — the chicken-and-egg

OIDC Trusted Publishing requires the package to **already exist** on
npm before trust can be configured (npm needs the package record to
attach trust to). That creates a chicken-and-egg: you need to publish
first, but the safe-by-default workflow uses provenance from CI, which
needs trust to be configured first.

### The bootstrap path

1. **Develop the MVP locally**. Run `/verify-solo-npm` until clean.
2. **Bump to 0.1.0** (or 1.0.0 — your call).
3. **Classic publish, locally, ONE time**:
   ```bash
   npm login                                # web 2FA, browser flow
   npm publish --access public              # without --provenance
   ```
   The package now exists on npm.
4. **Configure OIDC trust** via `npm-trust`:
   ```bash
   pnpm exec npm-trust --auto --repo <owner/repo> --workflow release.yml
   ```
   Or run the bundled `setup-npm-trust` skill in Claude Code for the
   full guided flow (auth gate, dry-run, configure, verify).
5. **Set `package.json#publishConfig`**:
   ```json
   "publishConfig": {
     "access": "public",
     "provenance": true
   }
   ```
6. **From here, every subsequent release uses `/release-solo-npm`** — no more
   classic publishes. CI handles publish via OIDC + provenance.

This is the only place the release flow needs a human at the keyboard
beyond the single `AskUserQuestion` approval. Everything else is
agent-driven.

---

## 6. Public vs custom / private registries

`npm-trust` and the release skill both treat the public npm registry as
the canonical case but support custom registries with one caveat:
**SLSA provenance only works on `registry.npmjs.org`**.

### Configuration (consumer-side, in `package.json`)

**Public npm (default)**:

```json
"publishConfig": {
  "access": "public",
  "provenance": true
}
```

**Custom / private registry**:

```json
"publishConfig": {
  "access": "public",
  "registry": "https://npm.your-internal-registry.example.com/"
}
```

Note the absence of `"provenance": true` in the custom case — Sigstore
signing is operated by npmjs.com infrastructure and won't sign for
other registries.

### What the doctor checks

The `REGISTRY_PROVENANCE_CONFLICT` warn-level check fires when:

- `publishConfig.registry` is set to a non-`registry.npmjs.org` URL
  **AND**
- `publishConfig.provenance` is `true`

The combo can't work. Doctor surfaces the remedy: either remove
`provenance: true` or change `registry` back to public npm.

### What the release skill does

Phase B of `/release-solo-npm` reads `publishConfig.registry`. If unset or
public, the summary shows "Trust ✓ (provenance present)". If custom,
"Trust ✗ skipped (custom registry)" — and Phase C.7's verification step
skips the `dist.attestations` check.

---

## 7. Monorepo handling

The release skill ships with a **monorepo block** in `SKILL.md` that
single-package consumers delete after install. Monorepo consumers keep
it. The block:

- Reads `<MAIN_PACKAGE_DIR>/package.json#version` for version detection
  in Phase B.
- Iterates `packages/*/package.json` in Phase C.1 to bump every
  package's version.
- Iterates packages in Phase C.7 to verify each on the registry.

The `release.yml` workflow for monorepos uses a packages-matrix shape
(see `gagle/ncbijs` as the canonical model: a verify job + a
packages-discovery job + a per-package publish job).

---

## 8. Pre-release versions

The release skill detects `x.y.z-pre.n` shape automatically and adapts
Phase B's `AskUserQuestion`:

| Mode | Detected by | Options |
|---|---|---|
| Stable | `^\d+\.\d+\.\d+$` | `Proceed with v{NEXT}` / `Override` / `Edit changelog` / `Abort` |
| Pre-release | `^\d+\.\d+\.\d+-[a-z]+\.\d+$` | `Bump pre-release counter` / `Promote to stable` / `Override` / `Abort` |

Starting a pre-release line: in stable mode, choose `Override version`
and type something like `1.3.0-beta.1`. The skill will accept it
verbatim and proceed.

Promoting back to stable: in pre-release mode, choose `Promote to
stable` — the skill strips the `-pre.n` suffix and bumps to the
next stable release.

---

## 9. The future bootstrap CLI (vision spec, NOT BUILT)

A fourth piece is sketched here as future work. Nothing in this spec is
implemented today — this section is the design brief for whoever picks
up the work later.

### What it would be

A CLI invoked once per fresh repo to scaffold the entire AI-driven
setup in one command:

```bash
npx <bootstrap-cli> init my-package
```

### What it would generate

- `package.json` with the right baseline (scripts, engines,
  `publishConfig`, `npm-trust:setup` script body).
- `tsconfig.json`, vitest config, eslint config (or no-eslint with
  `tsc --noEmit` as lint).
- `CLAUDE.md` (template parameterized with project name + stack).
- `.claude/skills/` populated with the standard set: commit, verify,
  release, review, testing.
- `.claude/rules/` populated with TypeScript / testing /
  review-criteria conventions.
- `.github/workflows/release.yml` — the canonical tag-triggered
  workflow with OIDC permissions + `pnpm publish --no-git-checks`.
- `.github/workflows/ci.yml` — push gating (since PRs are disabled).
- `CONTRIBUTING.md` — the AI-only template.
- `.gitignore`, `LICENSE`, `README.md` skeleton.

### Flags / prompts it would accept

- `--name <name>` — package name
- `--scope <scope>` — npm scope (optional)
- `--bundler <tsdown|tsc|esbuild>` — defaults to `tsdown`
- `--registry <url>` — public or custom (drives `publishConfig`)
- `--monorepo` — switches to a `packages/*` layout

### How it composes with the existing pieces

- For trust setup: doesn't bundle `setup-npm-trust`. Instead, generated
  `package.json` includes `npm-trust` as a devDep. After scaffolding,
  the user runs `pnpm exec npm-trust --auto …` (or invokes the bundled
  `setup-npm-trust` skill) once.
- For release skill: doesn't bundle either. Instead, the generated
  `README.md` has a "Next steps" section pointing at
  `/plugin marketplace add gagle/release-solo-npm` and
  `/plugin install release-solo-npm@gllamas-skills`.

This keeps the bootstrap CLI's surface area small. It's a generator,
not a runtime.

### Why deferred

The patterns are still settling. This doc captures them. When the
patterns stabilize, the bootstrap CLI is small enough to write in an
afternoon — but doing it prematurely would freeze decisions that
shouldn't be frozen yet.

### Open questions

- Should it integrate with the GitHub API to disable PRs at repo
  creation? Probably yes — that's part of "AI-driven solo dev", and
  it's the easiest place to set it.
- Should it support setting branch protection (force-push allowed for
  the maintainer, no merge queue)? Yes for symmetry with the workflow.
- Should it be its own published package, or a subcommand on
  `npm-trust`? Probably its own package — bootstrap is once-per-repo
  while `npm-trust` is per-release.

---

## 10. Why this works for AI-driven solo dev

- **Trust replaces review.** Tag-triggered CI runs the same verify
  gates the agent ran locally. SLSA provenance proves what was
  published, signed by GitHub's OIDC identity. There's nothing for a
  human reviewer to add — the agent already reasoned about correctness;
  CI re-verified.
- **One structured approval gate.** Not a free-text "yes/no" prompt
  (those blend into agent output). A clearly-labeled selector —
  unmissable. The human ratifies the plan; the agent executes.
- **Composable.** `/verify-solo-npm` is its own skill. `/release-solo-npm` is its own
  skill. `npm-trust` is its own package. Each piece can evolve
  independently.
- **No special cases.** Every release follows the same path: phase A →
  B → C. The "small fix" and "big feature" both go through the gates.
  No "I'll just push this one without testing" — the path doesn't
  permit it.
- **Boring is good.** Boring releases ship. Exciting releases get
  delayed by uncertainty. Pick boring.

---

## Related

- [`gagle/npm-trust`](https://github.com/gagle/npm-trust) — this repo.
- [`gagle/release-solo-npm`](https://github.com/gagle/release-solo-npm)
  — the marketplace plugin for `/release-solo-npm` and `/verify-solo-npm`.
