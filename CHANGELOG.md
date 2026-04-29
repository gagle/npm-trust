# Changelog

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
