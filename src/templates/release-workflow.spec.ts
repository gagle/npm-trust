import { describe, expect, it } from "vitest";
import { parseReleaseWorkflow } from "../workflow.js";
import { RELEASE_WORKFLOW_PUBLIC } from "./release-workflow.js";

describe("RELEASE_WORKFLOW_PUBLIC template", () => {
  it("should be a non-empty string", () => {
    expect(typeof RELEASE_WORKFLOW_PUBLIC).toBe("string");
    expect(RELEASE_WORKFLOW_PUBLIC.length).toBeGreaterThan(0);
  });

  it("should declare the workflow name as Release", () => {
    expect(RELEASE_WORKFLOW_PUBLIC).toContain("name: Release");
  });

  it("should trigger on tag push (v*)", () => {
    expect(RELEASE_WORKFLOW_PUBLIC).toContain("tags: ['v*']");
  });

  it("should declare id-token: write permission for OIDC", () => {
    expect(RELEASE_WORKFLOW_PUBLIC).toContain("id-token: write");
  });

  it("should use pnpm action-setup", () => {
    expect(RELEASE_WORKFLOW_PUBLIC).toContain("pnpm/action-setup");
  });

  it("should set registry-url to the public npmjs.org registry", () => {
    expect(RELEASE_WORKFLOW_PUBLIC).toContain("registry-url: https://registry.npmjs.org");
  });

  it("should publish with --no-git-checks (matches pnpm publish flow)", () => {
    expect(RELEASE_WORKFLOW_PUBLIC).toContain("pnpm publish --no-git-checks");
  });

  it("should reference the dist-tag output via GitHub Actions interpolation", () => {
    expect(RELEASE_WORKFLOW_PUBLIC).toContain("${{ steps.dist.outputs.tag }}");
  });

  it("should detect dist-tag based on package.json version + publishConfig.tag", () => {
    expect(RELEASE_WORKFLOW_PUBLIC).toContain("publishConfig?.tag");
  });

  it("should round-trip through parseReleaseWorkflow with hasIdTokenWrite=true", () => {
    const snapshot = parseReleaseWorkflow(RELEASE_WORKFLOW_PUBLIC);
    expect(snapshot.hasIdTokenWrite).toBe(true);
  });

  it("should have setupNodeRegistryUrl matching the public registry", () => {
    const snapshot = parseReleaseWorkflow(RELEASE_WORKFLOW_PUBLIC);
    expect(snapshot.setupNodeRegistryUrl).toBe("https://registry.npmjs.org");
  });

  it("should not declare always-auth (OIDC doesn't need it)", () => {
    const snapshot = parseReleaseWorkflow(RELEASE_WORKFLOW_PUBLIC);
    expect(snapshot.setupNodeAlwaysAuth).toBe(false);
  });

  it("should not declare a NODE_AUTH_TOKEN env (OIDC handles auth)", () => {
    const snapshot = parseReleaseWorkflow(RELEASE_WORKFLOW_PUBLIC);
    expect(snapshot.publishStepEnvAuthSecret).toBeNull();
  });

  it("should end with a trailing newline (standard file convention)", () => {
    expect(RELEASE_WORKFLOW_PUBLIC.endsWith("\n")).toBe(true);
  });
});
