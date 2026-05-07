import { describe, expect, it } from "vitest";
import { buildCapabilitiesReport, parsePackageVersion } from "./capabilities.js";

describe("buildCapabilitiesReport", () => {
  const report = buildCapabilitiesReport();

  it("emits schemaVersion 1", () => {
    expect(report.schemaVersion).toBe(1);
  });

  it("identifies as npm-trust", () => {
    expect(report.name).toBe("npm-trust");
  });

  it("reads the version from package.json", () => {
    expect(report.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("lists the public features", () => {
    expect(report.features).toEqual(
      expect.arrayContaining([
        "doctor",
        "validate-only",
        "verify-provenance",
        "emit-workflow",
        "with-prepare-dist",
        "list",
        "configure",
        "json-output",
      ]),
    );
  });

  it("describes every flag with a type", () => {
    const flagNames = report.flags.map((flag) => flag.name);
    expect(flagNames).toEqual(
      expect.arrayContaining([
        "--scope",
        "--packages",
        "--repo",
        "--workflow",
        "--auto",
        "--list",
        "--only-new",
        "--dry-run",
        "--doctor",
        "--json",
        "--emit-workflow",
        "--with-prepare-dist",
        "--verify-provenance",
        "--validate-only",
        "--capabilities",
        "--help",
      ]),
    );
    for (const flag of report.flags) {
      expect(["boolean", "string", "string-array"]).toContain(flag.type);
    }
  });

  it("declares the JSON schemas it can emit", () => {
    const schemas = report.jsonSchemas.map((entry) => entry.schema);
    expect(schemas).toEqual(
      expect.arrayContaining([
        "DoctorReport",
        "ListReport",
        "ValidateReport",
        "VerifyProvenanceReport",
        "ConfigureReport",
        "CapabilitiesReport",
      ]),
    );
    expect(report.jsonSchemas.find((s) => s.schema === "DoctorReport")?.version).toBe(2);
    expect(report.jsonSchemas.find((s) => s.schema === "VerifyProvenanceReport")?.version).toBe(2);
  });

  it("publishes the exit-code catalog", () => {
    const codeNames = report.exitCodes.map((entry) => entry.name);
    expect(codeNames).toEqual(
      expect.arrayContaining([
        "SUCCESS",
        "GENERIC_FAILURE",
        "CONFIGURATION_ERROR",
        "AUTH_FAILURE",
        "OTP_REQUIRED",
        "WORKSPACE_DETECTION_FAILED",
        "REGISTRY_UNREACHABLE",
        "WEB_2FA_TIMEOUT",
        "PARTIAL_FAILURE",
      ]),
    );
    expect(report.exitCodes.find((e) => e.name === "SUCCESS")?.code).toBe(0);
    expect(report.exitCodes.find((e) => e.name === "PARTIAL_FAILURE")?.code).toBe(60);
  });
});

describe("parsePackageVersion", () => {
  it("extracts the version field", () => {
    expect(parsePackageVersion(JSON.stringify({ version: "1.2.3" }))).toBe("1.2.3");
  });

  it("falls back to '0.0.0' when JSON is malformed", () => {
    expect(parsePackageVersion("not-json")).toBe("0.0.0");
  });

  it("falls back to '0.0.0' when version field is missing", () => {
    expect(parsePackageVersion(JSON.stringify({ name: "x" }))).toBe("0.0.0");
  });

  it("falls back to '0.0.0' when version is not a string", () => {
    expect(parsePackageVersion(JSON.stringify({ version: 42 }))).toBe("0.0.0");
  });

  it("falls back to '0.0.0' for null literal", () => {
    expect(parsePackageVersion("null")).toBe("0.0.0");
  });
});
