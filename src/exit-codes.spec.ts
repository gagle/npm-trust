import { describe, expect, it } from "vitest";
import { EXIT, type ExitCode } from "./exit-codes.js";

describe("EXIT codes", () => {
  it("should expose SUCCESS as 0", () => {
    expect(EXIT.SUCCESS).toBe(0);
  });

  it("should expose GENERIC_FAILURE as 1 (legacy backwards-compat)", () => {
    expect(EXIT.GENERIC_FAILURE).toBe(1);
  });

  it("should expose CONFIGURATION_ERROR as 10", () => {
    expect(EXIT.CONFIGURATION_ERROR).toBe(10);
  });

  it("should expose AUTH_FAILURE as 20", () => {
    expect(EXIT.AUTH_FAILURE).toBe(20);
  });

  it("should expose OTP_REQUIRED as 21", () => {
    expect(EXIT.OTP_REQUIRED).toBe(21);
  });

  it("should expose WORKSPACE_DETECTION_FAILED as 30", () => {
    expect(EXIT.WORKSPACE_DETECTION_FAILED).toBe(30);
  });

  it("should expose REGISTRY_UNREACHABLE as 40", () => {
    expect(EXIT.REGISTRY_UNREACHABLE).toBe(40);
  });

  it("should expose WEB_2FA_TIMEOUT as 50", () => {
    expect(EXIT.WEB_2FA_TIMEOUT).toBe(50);
  });

  it("should expose PARTIAL_FAILURE as 60", () => {
    expect(EXIT.PARTIAL_FAILURE).toBe(60);
  });

  it("should have ExitCode type assignable to all values", () => {
    // Compile-time check; runtime assertion just ensures type is exported.
    const success: ExitCode = EXIT.SUCCESS;
    const partial: ExitCode = EXIT.PARTIAL_FAILURE;
    expect(success).toBe(0);
    expect(partial).toBe(60);
  });

  it("should have all distinct numeric values", () => {
    const values = Object.values(EXIT);
    const set = new Set(values);
    expect(set.size).toBe(values.length);
  });
});
