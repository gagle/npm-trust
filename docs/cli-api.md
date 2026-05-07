# npm-trust — CLI API Stability Commitment

This document describes the **public contract** of the `npm-trust`
CLI. Downstream consumers (notably the [solo-npm](https://github.com/gagle/solo-npm)
marketplace plugin's `/trust`, `/release`, `/audit`, `/status` skills)
pin to this surface and rely on it to be stable across patch and minor
releases.

If you build automation against `npm-trust`, this doc is your contract.
The fields and exit codes described here are the **only** parts that
are guaranteed; everything else is implementation detail and may change
without notice.

---

## Stability levels

| Surface | Stability | Notes |
| --- | --- | --- |
| Exit codes (`EXIT.*` constants) | **Stable** | New codes may be added; existing codes never change meaning |
| `--doctor --json` schema | **Evolving additively** | `schemaVersion` bumps on additive changes |
| `--list --json` schema (`ListReport`) | **Evolving additively** | `schemaVersion` bumps on additive changes |
| Configure (`ConfigureReport`) JSON schema | **Evolving additively** | `schemaVersion` bumps on additive changes |
| `--validate-only --json` schema (`ValidateReport`) | **Evolving additively** | `schemaVersion` bumps on additive changes |
| `--verify-provenance --json` schema (`VerifyProvenanceReport`) | **Evolving additively** | `schemaVersion` bumps on additive changes |
| `--emit-workflow` template content | **Stable shape** | Specific values (action versions) may change |
| Human/text output | **Best-effort** | Don't parse it. Use `--json`. |
| Error message strings | **Best-effort** | Don't grep them. Match exit codes. |
| Library exports from `npm-trust` (Node) | **Stable** | Direct ES module imports for in-process use |

**Stable** = backwards-compatible across the entire `0.x` line.
Breaking changes will only ship in a major version (`1.0.0+`).

**Evolving additively** = the schema only adds new fields. Existing
fields keep their semantics. Consumers should use optional chaining
when reading new fields. Each schema's `schemaVersion` integer bumps
when the schema gains a new field.

**Best-effort** = subject to wording, formatting, and emoji changes
between minor releases. If you depend on it, you'll be on your own.

---

## CLI flag reference

### Discovery + targeting

| Flag | Type | Description |
| --- | --- | --- |
| `--scope <scope>` | string | npm scope (e.g. `@ncbijs`); discovers all public packages |
| `--packages <name…>` | string[] | explicit package names; mutually compatible with positionals |
| `--auto` | boolean | detect packages from cwd (`pnpm-workspace.yaml`, `package.json#workspaces`, single `package.json`) |
| `--repo <owner/repo>` | string | GitHub repository slug |
| `--workflow <file>` | string | GitHub Actions workflow filename (e.g. `release.yml`) |
| `--only-new` | boolean | filter to packages without OIDC trust or unpublished |
| `--dry-run` | boolean | print what would happen without making changes |

### Read-only commands

| Flag | Description | Exit codes |
| --- | --- | --- |
| `--list` | list current trust status for the discovered/named packages | `0` |
| `--doctor` | full environment + per-package health report | `0` ok, `1` if a `fail`-severity issue is present |
| `--validate-only` | fast pre-flight: workflow + repo + auth checks, no per-package npm calls | `0` ready, `1` not ready |
| `--verify-provenance` | bulk-query provenance attestations for the discovered/named packages | `0` |
| `--emit-workflow` | print the canonical OIDC `release.yml` to stdout | `0` |
| `--with-prepare-dist` | modifier for `--emit-workflow`; emits the variant that includes a `gagle/prepare-dist@v1` step | `0`, or `10` if used without `--emit-workflow` |
| `--capabilities` | emit a `CapabilitiesReport` JSON describing the CLI surface (for tool-discovery) | `0` |

### Output format

| Flag | Description |
| --- | --- |
| `--json` | emit machine-readable JSON. Combines with `--doctor`, `--list`, `--validate-only`, `--verify-provenance`, and configure paths. |

`--json` is **not** supported with `--emit-workflow` — that command
always emits raw YAML so it can be piped directly to a workflow file.

---

## Exit codes

`npm-trust` uses structured exit codes to allow downstreams to make
deterministic recovery decisions without parsing stderr.

| Code | Constant | Meaning |
| --- | --- | --- |
| `0` | `EXIT.SUCCESS` | command completed without errors |
| `1` | `EXIT.GENERIC_FAILURE` | catch-all (Node version unmet, doctor `fail`-severity issue, validate-only failed) |
| `10` | `EXIT.CONFIGURATION_ERROR` | invalid/missing/conflicting flags (e.g., `--validate-only` with `--doctor`, missing `--repo`/`--workflow`) |
| `20` | `EXIT.AUTH_FAILURE` | npm auth missing or rejected |
| `21` | `EXIT.OTP_REQUIRED` | reserved — npm `EOTP` / web-2FA gate hit and not yet automated |
| `30` | `EXIT.WORKSPACE_DETECTION_FAILED` | `--auto` could not detect any packages, or discovery returned an empty list |
| `40` | `EXIT.REGISTRY_UNREACHABLE` | reserved for network/5xx classification |
| `50` | `EXIT.WEB_2FA_TIMEOUT` | reserved for browser 2FA flow timeouts |
| `60` | `EXIT.PARTIAL_FAILURE` | configure ran to completion but at least one package failed |

The constants are exported from the `npm-trust` package as `EXIT` and
can be imported in Node consumers:

```ts
import { EXIT, type ExitCode } from "npm-trust";
```

**Backwards-compatibility note** — versions before 0.10.0 returned
exit code `1` for all configure/list failures. Starting in 0.10.0,
configure paths return `60` (PARTIAL_FAILURE) on per-package failure,
and configuration errors return `10` (CONFIGURATION_ERROR). Tools that
currently treat any non-zero as a failure remain correct; tools that
want to distinguish should switch to the structured codes.

---

## JSON schemas

All JSON output starts with `schemaVersion`. When new fields are added,
`schemaVersion` bumps. Existing field semantics never change within the
same major version line.

### `--doctor --json` → `DoctorReport`

```ts
interface DoctorReport {
  schemaVersion: 1 | 2;
  workflowSnapshot?: WorkflowSnapshotReport;  // 0.10.0+
  cli: { version: string; path: string };
  runtime: {
    node: VersionCheck;
    npm: VersionCheck;
    platform: string;
  };
  auth: { loggedIn: boolean; username: string | null; registry: string };
  workspace: DiscoveredWorkspace | null;
  repo: { url: string | null; inferredSlug: string | null; host: "github" | "other" | null };
  workflows: ReadonlyArray<string>;
  packages: ReadonlyArray<PackageDoctorEntry>;
  issues: ReadonlyArray<DoctorIssue>;
  summary: { ok: number; warn: number; fail: number };
}

interface PackageDoctorEntry {
  pkg: string;
  trustConfigured: boolean;
  published: boolean;
  hasProvenance: boolean;
  discrepancies: ReadonlyArray<string>;
  latestVersion?: string;             // 0.10.0+
  lastSuccessfulPublish?: string;     // 0.10.0+ — ISO 8601
  unpackedSize?: number;              // 0.11.0+
  perPackageIssueCodes: ReadonlyArray<DoctorIssueCode>;  // 0.10.0+
}

interface WorkflowSnapshotReport {
  file: string;
  fileHash: string;                   // sha256 hex
  hasIdTokenWrite: boolean;
  setupNodeRegistryUrl: string | null;
  setupNodeAlwaysAuth: boolean;
  publishStepEnvAuthSecret: string | null;
}
```

`schemaVersion` history:

- `1` — initial doctor report (≤ 0.9.x).
- `2` — added `workflowSnapshot`, `latestVersion`,
  `lastSuccessfulPublish`, `perPackageIssueCodes`.

### `--list --json` → `ListReport`

```ts
interface ListReport {
  schemaVersion: 1;
  packages: ReadonlyArray<{
    pkg: string;
    trustConfigured: boolean;
    raw: string;            // raw `npm trust list` stdout for forensics
  }>;
}
```

### Configure `--json` → `ConfigureReport`

Emitted when `npm-trust` runs in configure mode (no `--list`,
`--doctor`, etc.) with `--json`.

```ts
interface ConfigureReport {
  schemaVersion: 1;
  summary: {
    configured: number;
    already: number;
    failed: number;
    failedPackages: ReadonlyArray<string>;
  };
  entries: ReadonlyArray<{
    pkg: string;
    result: "configured" | "already" | "not_published" | "auth_failed" | "error" | "dry_run";
  }>;
}
```

### `--validate-only --json` → `ValidateReport`

```ts
interface ValidateReport {
  schemaVersion: 1;
  workflow: WorkflowSnapshotReport | { found: false; error: string };
  repo: { url: string | null; inferredSlug: string | null; host: "github" | "other" | null };
  auth: { loggedIn: boolean; username: string | null; registry: string };
  ready: boolean;
  failures: ReadonlyArray<string>;
}
```

### `--verify-provenance --json` → `VerifyProvenanceReport`

```ts
interface VerifyProvenanceReport {
  schemaVersion: 1 | 2;
  packages: ReadonlyArray<{
    pkg: string;
    latestVersion: string | null;
    provenancePresent: boolean;
    attestationCount: number;
    lastAttestationAt: string | null;   // ISO 8601
    unpackedSize?: number;              // 0.11.0+ (schemaVersion 2)
  }>;
  summary: {
    total: number;
    withProvenance: number;
    withoutProvenance: number;
    unpublished: number;
  };
}
```

`schemaVersion` history:

- `1` — initial verify-provenance report (0.10.0).
- `2` — added optional `unpackedSize` per package (0.11.0).

### `--capabilities --json` → `CapabilitiesReport`

Tool-discovery descriptor. Solo-npm-style orchestrators read this to
detect at runtime which features the installed `npm-trust` exposes.

```ts
interface CapabilitiesReport {
  schemaVersion: 1;
  name: 'npm-trust';
  version: string;            // semver from package.json
  features: ReadonlyArray<string>;
  flags: ReadonlyArray<{ name: string; type: 'boolean' | 'string' | 'string-array' }>;
  jsonSchemas: ReadonlyArray<{ flag: string; schema: string; version: number }>;
  exitCodes: ReadonlyArray<{ code: number; name: string }>;
}
```

The same shape is emitted by `prepare-dist --capabilities --json`
(with `name: "prepare-dist"`), allowing cross-tool orchestrators to
treat the descriptor uniformly.

---

## Library exports (Node consumers)

For Node-side consumers, `npm-trust` exports its public functions and
types directly. Imports are stable and follow the same backwards-compat
guarantees as the CLI.

```ts
import {
  // commands
  runDoctor,
  runValidate,
  verifyProvenance,
  configureTrust,
  listTrust,
  // collectors (return reports without emitting)
  collectReport,
  collectValidateReport,
  // formatters
  formatDoctorReportJson,
  formatDoctorReportHuman,
  formatValidateReportJson,
  formatValidateReportHuman,
  formatVerifyProvenanceJson,
  formatVerifyProvenanceHuman,
  // exit codes
  EXIT,
  // workflow helpers
  readWorkflowSnapshotReport,
  // discovery
  discoverPackages,
  discoverFromCwd,
  parsePnpmWorkspacePackages,
  checkPackageStatuses,
  checkPackageStatusesAsync,
  findUnconfiguredPackages,
} from "npm-trust";
```

All types listed in the JSON schemas section are exported as well.

---

## Migration notes — 0.11.0

- `VerifyProvenanceReport.schemaVersion` bumped from `1` to `2`.
  Consumers that hardcode `=== 1` should switch to `>= 1`. New
  `unpackedSize` field is optional.
- `PackageDoctorEntry` gained an optional `unpackedSize` field. No
  schemaVersion bump (still `2`); the field is optional and additive.
- New flags: `--with-prepare-dist`, `--capabilities`. Both are pure
  additions; existing flag combinations are unchanged.

## Migration notes — 0.10.0

- `DoctorReport.schemaVersion` bumped from `1` to `2`. Consumers that
  hardcode `=== 1` should switch to `>= 1` or read fields with optional
  chaining.
- Configure paths now return `60` (PARTIAL_FAILURE) instead of `1` on
  per-package failure. Tools using `if (rc !== 0)` are unaffected.
- New flags: `--emit-workflow`, `--validate-only`, `--verify-provenance`.
- `--json` now applies to `--list` and configure paths (previously
  was only honored by `--doctor` and `--verify-provenance`).
- Workflow regex (`hasIdTokenWrite`) now accepts a trailing `# comment`
  on the `id-token: write` line (was previously strict-EOL — fixed).

---

## Future work

These items are explicit non-goals for the current major. They are
documented here to make the project's roadmap visible — most are
intentionally rejected for architectural reasons rather than dropped
for lack of time.

### Considered but deferred to a future minor

- **Workspace format expansion** — Nx, Rush, Lerna, and Bun monorepo
  layouts are not yet detected by `--auto`. Today only pnpm
  workspaces, npm workspaces, and single-package layouts are
  supported. PRs welcome with detection rules.
- **`--no-color` / `--no-emoji` flags** — human output uses ✓/✗/⚠ and
  ANSI colors. Output is stable enough for CI logs, but a no-cosmetics
  mode would help screen-readers and minimal terminals.
- **EOTP detection helper** — when `npm trust github` returns `EOTP`,
  `npm-trust` could detect this proactively (before the registry round
  trip) and warn the user that they'll need to web-2FA per package.

### Explicit non-goals

- **Library API for solo-npm to consume Node-side** — solo-npm is a
  markdown + bash plugin, not a Node application. A library API doesn't
  fit its architecture. solo-npm calls `npm-trust` via CLI + JSON,
  which is what this stability commitment supports.
- **`state.json` schema compatibility with solo-npm** — the v0.9.0
  refocus deliberately separated concerns: `npm-trust` evolves with
  npm's APIs (registry, OIDC, attestation formats); solo-npm evolves
  with AI workflow needs. Coupling caches across that boundary would
  re-create the very dependency we just dissolved.
- **`--first-publish-bootstrap` combo command** — duplicates solo-npm's
  `/init` + `/trust` chain, which solves the same problem with a
  user-visible AskUserQuestion gate. Doing it inside `npm-trust` skips
  the safety prompts.
- **`--cache-output <file>` writing to solo-npm's `state.json`** —
  same coupling violation as state.json compatibility. solo-npm
  consumes `--json` and writes to its own cache.
- **Telemetry hooks emitting to solo-npm-specific paths** — same
  coupling violation. If consumers want event hooks, they parse JSON
  output line-by-line.

### Out of scope by design

- **Authentication mechanism beyond `npm whoami`** — `npm-trust` trusts
  npm's auth state. It does not log users in, refresh tokens, or
  manage credentials.
- **Non-GitHub trust providers** — `npm trust github` is the only
  mechanism npm exposes today. When npm adds GitLab/Bitbucket trust,
  `npm-trust` will follow.
