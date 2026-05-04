import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseReleaseWorkflow, readReleaseWorkflow } from "./workflow.js";

describe("parseReleaseWorkflow", () => {
  describe("when the workflow uses OIDC + setup-node", () => {
    let result: ReturnType<typeof parseReleaseWorkflow>;

    beforeEach(() => {
      const content = `name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm publish --no-git-checks
`;
      result = parseReleaseWorkflow(content);
    });

    it("should detect id-token: write", () => {
      expect(result.hasIdTokenWrite).toBe(true);
    });

    it("should capture setup-node registry-url", () => {
      expect(result.setupNodeRegistryUrl).toBe("https://registry.npmjs.org");
    });

    it("should report alwaysAuth false (not set in this workflow)", () => {
      expect(result.setupNodeAlwaysAuth).toBe(false);
    });

    it("should report no NODE_AUTH_TOKEN secret", () => {
      expect(result.publishStepEnvAuthSecret).toBeNull();
    });
  });

  describe("when the workflow uses NODE_AUTH_TOKEN with a secret", () => {
    let result: ReturnType<typeof parseReleaseWorkflow>;

    beforeEach(() => {
      const content = `name: Release

permissions:
  contents: read

jobs:
  publish:
    steps:
      - uses: actions/setup-node@v6
        with:
          registry-url: https://npm.example.com/
          always-auth: true
      - run: pnpm publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;
      result = parseReleaseWorkflow(content);
    });

    it("should NOT detect id-token: write", () => {
      expect(result.hasIdTokenWrite).toBe(false);
    });

    it("should capture the registry-url", () => {
      expect(result.setupNodeRegistryUrl).toBe("https://npm.example.com/");
    });

    it("should detect always-auth: true", () => {
      expect(result.setupNodeAlwaysAuth).toBe(true);
    });

    it("should capture the secret name from NODE_AUTH_TOKEN", () => {
      expect(result.publishStepEnvAuthSecret).toBe("NPM_TOKEN");
    });
  });

  describe("when setup-node has a quoted registry-url", () => {
    it("should strip surrounding double quotes", () => {
      const content = `      - uses: actions/setup-node@v6
        with:
          registry-url: "https://npm.example.com/"`;
      expect(parseReleaseWorkflow(content).setupNodeRegistryUrl).toBe("https://npm.example.com/");
    });

    it("should strip surrounding single quotes", () => {
      const content = `      - uses: actions/setup-node@v6
        with:
          registry-url: 'https://npm.example.com/'`;
      expect(parseReleaseWorkflow(content).setupNodeRegistryUrl).toBe("https://npm.example.com/");
    });
  });

  describe("when the workflow has no setup-node block", () => {
    it("should return null setup-node fields", () => {
      const result = parseReleaseWorkflow("name: Release\non: push\n");
      expect(result.setupNodeRegistryUrl).toBeNull();
      expect(result.setupNodeAlwaysAuth).toBe(false);
    });
  });

  describe("when setup-node block is followed by a sibling step", () => {
    let result: ReturnType<typeof parseReleaseWorkflow>;

    beforeEach(() => {
      const content = `      - uses: actions/setup-node@v6
        with:
          registry-url: https://npm.example.com/

      - uses: actions/checkout@v6
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
`;
      result = parseReleaseWorkflow(content);
    });

    it("should not bleed the setup-node block into the sibling step", () => {
      expect(result.setupNodeRegistryUrl).toBe("https://npm.example.com/");
    });

    it("should not capture sibling step auth as setup-node always-auth", () => {
      expect(result.setupNodeAlwaysAuth).toBe(false);
    });
  });
});

const readFileMock = vi.fn();
vi.mock("node:fs/promises", () => ({
  readFile: (...args: ReadonlyArray<unknown>) => readFileMock(...args),
}));

describe("readReleaseWorkflow", () => {
  afterEach(() => {
    readFileMock.mockReset();
  });

  describe("when the file exists", () => {
    it("should parse and return the snapshot", async () => {
      readFileMock.mockResolvedValueOnce("permissions:\n  id-token: write\n");
      const result = await readReleaseWorkflow("/tmp/repo", "release.yml");
      expect(result?.hasIdTokenWrite).toBe(true);
    });
  });

  describe("when the file is missing", () => {
    it("should return null", async () => {
      readFileMock.mockRejectedValueOnce(new Error("ENOENT"));
      const result = await readReleaseWorkflow("/tmp/repo", "release.yml");
      expect(result).toBeNull();
    });
  });
});
