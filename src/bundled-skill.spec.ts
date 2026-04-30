import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const SKILL_PATH = fileURLToPath(new URL("../skills/setup-npm-trust/SKILL.md", import.meta.url));

describe("bundled setup-npm-trust skill", () => {
  let content: string;

  beforeAll(() => {
    content = readFileSync(SKILL_PATH, "utf-8");
  });

  describe("frontmatter", () => {
    it("should start with the YAML delimiter", () => {
      expect(content.startsWith("---\n")).toBe(true);
    });

    it("should declare the skill name", () => {
      expect(content).toMatch(/^name:\s*setup-npm-trust$/m);
    });

    it("should include a non-empty description", () => {
      const match = content.match(/^description:\s*>\n((?:\s+.+\n)+)/m);
      expect(match?.[1]?.trim()).toBeTruthy();
    });
  });

  describe("structure", () => {
    it("should declare a Phase 1 — Discover section", () => {
      expect(content).toContain("## Phase 1 — Discover");
    });

    it("should declare a Phase 2 — Execute section", () => {
      expect(content).toContain("## Phase 2 — Execute");
    });

    it("should describe when to use the skill", () => {
      expect(content).toContain("## When to use");
    });
  });

  describe("package-manager neutrality", () => {
    it("should invoke the CLI through npx in every example", () => {
      expect(content).toContain("npx npm-trust-cli");
    });

    it("should not assume pnpm by hardcoding pnpm exec", () => {
      expect(content).not.toContain("pnpm exec npm-trust-cli");
    });
  });
});
