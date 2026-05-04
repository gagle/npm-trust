import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseNpmrc, readNpmrc } from "./npmrc.js";

describe("parseNpmrc", () => {
  describe("when the file is empty", () => {
    it("should return null registry, empty scopes, empty authRefs", () => {
      const result = parseNpmrc("");
      expect(result).toStrictEqual({ registry: null, scopes: [], authRefs: [] });
    });
  });

  describe("when the file has only comments and blank lines", () => {
    it("should return empty snapshot", () => {
      const content = `
; this is a comment
# another comment

`;
      expect(parseNpmrc(content)).toStrictEqual({ registry: null, scopes: [], authRefs: [] });
    });
  });

  describe("when the file sets a top-level registry", () => {
    it("should capture the registry value", () => {
      expect(parseNpmrc("registry=https://npm.example.com/").registry).toBe(
        "https://npm.example.com/",
      );
    });

    it("should tolerate whitespace around `=`", () => {
      expect(parseNpmrc("registry  =  https://npm.example.com/").registry).toBe(
        "https://npm.example.com/",
      );
    });
  });

  describe("when the file has scoped registry mappings", () => {
    it("should collect each scope mapping", () => {
      const content = `
@my-org:registry=https://npm.example.com/
@other:registry = https://other.example.com/
`;
      expect(parseNpmrc(content).scopes).toStrictEqual([
        { scope: "@my-org", registry: "https://npm.example.com/" },
        { scope: "@other", registry: "https://other.example.com/" },
      ]);
    });
  });

  describe("when the file has an _authToken with a ${VAR} reference", () => {
    let authRefs: ReadonlyArray<{
      host: string;
      value: string;
      lineNumber: number;
      isLiteral: boolean;
    }>;

    beforeEach(() => {
      authRefs = parseNpmrc("//npm.example.com/:_authToken=${NPM_TOKEN}\n").authRefs;
    });

    it("should capture the host, value, and line number", () => {
      expect(authRefs).toStrictEqual([
        {
          host: "//npm.example.com/",
          value: "${NPM_TOKEN}",
          lineNumber: 1,
          isLiteral: false,
        },
      ]);
    });
  });

  describe("when the file has an _authToken with a literal value", () => {
    it("should mark isLiteral true", () => {
      const result = parseNpmrc("//npm.example.com/:_authToken=npm_abc123XYZ\n");
      expect(result.authRefs[0]?.isLiteral).toBe(true);
    });
  });

  describe("when the file has an unrecognized line", () => {
    it("should ignore the line silently (no scopes / registry / authRefs added)", () => {
      const result = parseNpmrc("save-exact=true\nfoo=bar\n");
      expect(result).toStrictEqual({ registry: null, scopes: [], authRefs: [] });
    });
  });

  describe("when the file has multiple lines", () => {
    let result: ReturnType<typeof parseNpmrc>;

    beforeEach(() => {
      const content = `
; configure private registry
@my-org:registry=https://npm.example.com/
//npm.example.com/:_authToken=\${NPM_TOKEN}
registry=https://registry.npmjs.org/
`;
      result = parseNpmrc(content);
    });

    it("should capture the top-level registry", () => {
      expect(result.registry).toBe("https://registry.npmjs.org/");
    });

    it("should capture the scope mapping", () => {
      expect(result.scopes).toStrictEqual([
        { scope: "@my-org", registry: "https://npm.example.com/" },
      ]);
    });

    it("should capture the auth ref with correct line number", () => {
      expect(result.authRefs[0]).toMatchObject({
        host: "//npm.example.com/",
        lineNumber: 4,
        isLiteral: false,
      });
    });
  });
});

const readFileMock = vi.fn();
vi.mock("node:fs/promises", () => ({
  readFile: (...args: ReadonlyArray<unknown>) => readFileMock(...args),
}));

describe("readNpmrc", () => {
  afterEach(() => {
    readFileMock.mockReset();
  });

  describe("when .npmrc exists", () => {
    it("should parse and return the snapshot", async () => {
      readFileMock.mockResolvedValueOnce("registry=https://npm.example.com/");
      const result = await readNpmrc("/tmp/repo");
      expect(result?.registry).toBe("https://npm.example.com/");
    });
  });

  describe("when .npmrc is missing", () => {
    it("should return null", async () => {
      readFileMock.mockRejectedValueOnce(new Error("ENOENT"));
      const result = await readNpmrc("/tmp/repo");
      expect(result).toBeNull();
    });
  });
});
