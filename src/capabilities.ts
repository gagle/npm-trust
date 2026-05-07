import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT } from "./exit-codes.js";
import type { CapabilitiesReport } from "./interfaces/cli.interface.js";

export function buildCapabilitiesReport(): CapabilitiesReport {
  return {
    schemaVersion: 1,
    name: "npm-trust",
    version: readSelfVersion(),
    features: [
      "doctor",
      "validate-only",
      "verify-provenance",
      "emit-workflow",
      "with-prepare-dist",
      "list",
      "configure",
      "discover-scope",
      "discover-workspace",
      "json-output",
    ],
    flags: [
      { name: "--scope", type: "string" },
      { name: "--packages", type: "string-array" },
      { name: "--repo", type: "string" },
      { name: "--workflow", type: "string" },
      { name: "--auto", type: "boolean" },
      { name: "--list", type: "boolean" },
      { name: "--only-new", type: "boolean" },
      { name: "--dry-run", type: "boolean" },
      { name: "--doctor", type: "boolean" },
      { name: "--json", type: "boolean" },
      { name: "--emit-workflow", type: "boolean" },
      { name: "--with-prepare-dist", type: "boolean" },
      { name: "--verify-provenance", type: "boolean" },
      { name: "--validate-only", type: "boolean" },
      { name: "--capabilities", type: "boolean" },
      { name: "--help", type: "boolean" },
    ],
    jsonSchemas: [
      { flag: "--doctor --json", schema: "DoctorReport", version: 2 },
      { flag: "--list --json", schema: "ListReport", version: 1 },
      { flag: "--validate-only --json", schema: "ValidateReport", version: 1 },
      { flag: "--verify-provenance --json", schema: "VerifyProvenanceReport", version: 2 },
      { flag: "--json (configure)", schema: "ConfigureReport", version: 1 },
      { flag: "--capabilities --json", schema: "CapabilitiesReport", version: 1 },
    ],
    exitCodes: [
      { code: EXIT.SUCCESS, name: "SUCCESS" },
      { code: EXIT.GENERIC_FAILURE, name: "GENERIC_FAILURE" },
      { code: EXIT.CONFIGURATION_ERROR, name: "CONFIGURATION_ERROR" },
      { code: EXIT.AUTH_FAILURE, name: "AUTH_FAILURE" },
      { code: EXIT.OTP_REQUIRED, name: "OTP_REQUIRED" },
      { code: EXIT.WORKSPACE_DETECTION_FAILED, name: "WORKSPACE_DETECTION_FAILED" },
      { code: EXIT.REGISTRY_UNREACHABLE, name: "REGISTRY_UNREACHABLE" },
      { code: EXIT.WEB_2FA_TIMEOUT, name: "WEB_2FA_TIMEOUT" },
      { code: EXIT.PARTIAL_FAILURE, name: "PARTIAL_FAILURE" },
    ],
  };
}

export function parsePackageVersion(content: string): string {
  try {
    const parsed: unknown = JSON.parse(content);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      typeof parsed.version === "string"
    ) {
      return parsed.version;
    }
  } catch {
    // fall through
  }
  return "0.0.0";
}

function readSelfVersion(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(moduleDir, "..", "package.json");
  return parsePackageVersion(readFileSync(packageJsonPath, "utf-8"));
}
