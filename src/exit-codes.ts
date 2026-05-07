/**
 * Structured exit codes for the npm-trust CLI.
 *
 * Downstream consumers (notably `solo-npm`'s `/trust` skill) branch on the
 * exit code to distinguish failure classes. Prior to v0.10.0 the CLI used
 * 0/1 only; v0.10.0 introduces this enumeration so consumers can react
 * deterministically without regex-parsing stderr.
 *
 * Backward compatibility:
 * - `0` still means success.
 * - `1` (`GENERIC_FAILURE`) is preserved for legacy paths (notably `--doctor`,
 *   where failures are advisory not destructive). New paths use the codes
 *   below.
 */
export const EXIT = {
  /** Successful run — no errors. */
  SUCCESS: 0,
  /** Generic failure — preserved for `--doctor` advisory failures and other legacy paths. */
  GENERIC_FAILURE: 1,
  /** Bad/conflicting CLI flags — e.g. `--doctor` with `--auto`. */
  CONFIGURATION_ERROR: 10,
  /** `npm whoami` failed; user is not logged in or token is rejected (HTTP 403). */
  AUTH_FAILURE: 20,
  /** A package config call failed because npm requires an OTP / 2FA prompt. */
  OTP_REQUIRED: 21,
  /** `--auto` could not detect a workspace from the current directory. */
  WORKSPACE_DETECTION_FAILED: 30,
  /** Network failure or registry returned 5xx. */
  REGISTRY_UNREACHABLE: 40,
  /** Web 2FA flow timed out / browser auth was cancelled. */
  WEB_2FA_TIMEOUT: 50,
  /** Some packages succeeded, some failed; configure path completed with errors. */
  PARTIAL_FAILURE: 60,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
