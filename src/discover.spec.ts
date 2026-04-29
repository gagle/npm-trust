import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverPackages } from "./discover.js";

interface RegistryPage {
  readonly objects: ReadonlyArray<{ readonly package: { readonly name: string } }>;
  readonly total: number;
}

function fakeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pageResponse(body: RegistryPage, status = 200): Response {
  return fakeResponse(body, status);
}

describe("discoverPackages", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  describe("when the scope is missing the leading @", () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(pageResponse({ objects: [], total: 0 }));
      await discoverPackages("myorg");
    });

    it("should call the registry with @ prepended to the scope", () => {
      expect(fetchMock.mock.calls[0]?.[0]).toContain(encodeURIComponent("@myorg"));
    });
  });

  describe("when the scope already has a leading @", () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(pageResponse({ objects: [], total: 0 }));
      await discoverPackages("@myorg");
    });

    it("should call the registry with the @ prefix preserved", () => {
      expect(fetchMock.mock.calls[0]?.[0]).toContain(encodeURIComponent("@myorg"));
    });
  });

  describe("when the registry returns a single page", () => {
    let result: ReadonlyArray<string>;

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(
        pageResponse({
          objects: [{ package: { name: "@x/b" } }, { package: { name: "@x/a" } }],
          total: 2,
        }),
      );
      result = await discoverPackages("@x");
    });

    it("should return the package names sorted alphabetically", () => {
      expect(result).toStrictEqual(["@x/a", "@x/b"]);
    });

    it("should fetch exactly once", () => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the registry response spans two pages", () => {
    let result: ReadonlyArray<string>;

    beforeEach(async () => {
      const firstPage = Array.from({ length: 250 }, (_, index) => ({
        package: { name: `@x/p${String(index).padStart(3, "0")}` },
      }));
      const secondPage = [{ package: { name: "@x/p999" } }];
      fetchMock
        .mockResolvedValueOnce(pageResponse({ objects: firstPage, total: 251 }))
        .mockResolvedValueOnce(pageResponse({ objects: secondPage, total: 251 }));
      result = await discoverPackages("@x");
    });

    it("should aggregate names from every page", () => {
      expect(result).toHaveLength(251);
    });

    it("should issue one request per page", () => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should advance the from offset on subsequent pages", () => {
      expect(fetchMock.mock.calls[1]?.[0]).toContain("from=250");
    });
  });

  describe("when the registry returns an empty objects array", () => {
    let result: ReadonlyArray<string>;

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(pageResponse({ objects: [], total: 999 }));
      result = await discoverPackages("@x");
    });

    it("should stop pagination and return an empty list", () => {
      expect(result).toStrictEqual([]);
    });
  });

  describe("when fetch is called", () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(pageResponse({ objects: [], total: 0 }));
      await discoverPackages("@x");
    });

    it("should pass an AbortSignal for request timeout", () => {
      expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("when the registry responds with a non-ok status", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(pageResponse({ objects: [], total: 0 }, 503));
    });

    it("should throw an error including the status code", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/Registry search failed: 503/);
    });
  });

  describe("when NPM_TRUST_CLI_REGISTRY ends with a trailing slash", () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(pageResponse({ objects: [], total: 0 }));
      vi.stubEnv("NPM_TRUST_CLI_REGISTRY", "http://127.0.0.1:1234/");
      await discoverPackages("@x");
    });

    it("should target the configured registry with the trailing slash stripped", () => {
      expect(fetchMock.mock.calls[0]?.[0]).toMatch(/^http:\/\/127\.0\.0\.1:1234\/-\/v1\/search/);
    });
  });

  describe("when NPM_TRUST_CLI_REGISTRY uses http://localhost", () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(pageResponse({ objects: [], total: 0 }));
      vi.stubEnv("NPM_TRUST_CLI_REGISTRY", "http://localhost:4873");
      await discoverPackages("@x");
    });

    it("should accept the localhost URL and use it as the registry", () => {
      expect(fetchMock.mock.calls[0]?.[0]).toMatch(/^http:\/\/localhost:4873\//);
    });
  });

  describe("when NPM_TRUST_CLI_REGISTRY is malformed", () => {
    beforeEach(() => {
      vi.stubEnv("NPM_TRUST_CLI_REGISTRY", "not a url");
    });

    it("should throw an Invalid NPM_TRUST_CLI_REGISTRY error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/Invalid NPM_TRUST_CLI_REGISTRY/);
    });
  });

  describe("when NPM_TRUST_CLI_REGISTRY uses http for a non-localhost host", () => {
    beforeEach(() => {
      vi.stubEnv("NPM_TRUST_CLI_REGISTRY", "http://evil.example.com");
    });

    it("should reject the URL with a protocol-policy error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(
        /require https:\/\/, or http:\/\/ for localhost/,
      );
    });
  });

  describe("when NPM_TRUST_CLI_REGISTRY uses a non-http(s) protocol", () => {
    beforeEach(() => {
      vi.stubEnv("NPM_TRUST_CLI_REGISTRY", "ftp://registry.example.com");
    });

    it("should reject the URL as invalid", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/Invalid NPM_TRUST_CLI_REGISTRY/);
    });
  });

  describe("when the registry returns a non-object body", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(fakeResponse("nope"));
    });

    it("should throw a 'not an object' error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/not an object/);
    });
  });

  describe("when the registry returns objects as a non-array", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(fakeResponse({ objects: "x", total: 0 }));
    });

    it("should throw a missing-objects-array error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/missing 'objects' array/);
    });
  });

  describe("when the registry returns total as a non-numeric value", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(fakeResponse({ objects: [], total: "lots" }));
    });

    it("should throw a finite-non-negative-total error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/finite non-negative 'total'/);
    });
  });

  describe("when the registry returns total as Infinity", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(fakeResponse({ objects: [], total: Infinity }));
    });

    it("should throw a finite-non-negative-total error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/finite non-negative 'total'/);
    });
  });

  describe("when the registry returns total as a negative number", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(fakeResponse({ objects: [], total: -1 }));
    });

    it("should throw a finite-non-negative-total error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/finite non-negative 'total'/);
    });
  });

  describe("when an objects entry is not an object", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(fakeResponse({ objects: ["bad"], total: 1 }));
    });

    it("should throw an entry-not-an-object error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/'objects' entry is not an object/);
    });
  });

  describe("when an objects entry is missing the package field", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(fakeResponse({ objects: [{}], total: 1 }));
    });

    it("should throw a missing-package error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/missing 'package'/);
    });
  });

  describe("when an objects entry has package.name as a non-string", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        fakeResponse({ objects: [{ package: { name: 42 } }], total: 1 }),
      );
    });

    it("should throw a missing-package-name error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/missing string 'package.name'/);
    });
  });

  describe("when an objects entry has package as a non-object", () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(fakeResponse({ objects: [{ package: "x" }], total: 1 }));
    });

    it("should throw a missing-package error", async () => {
      await expect(discoverPackages("@x")).rejects.toThrow(/missing 'package'/);
    });
  });

  describe("when pagination would exceed the 10000-result cap", () => {
    let result: ReadonlyArray<string>;

    beforeEach(async () => {
      const fullPage = Array.from({ length: 250 }, (_, index) => ({
        package: { name: `@x/p${String(index).padStart(5, "0")}` },
      }));
      for (let pageIndex = 0; pageIndex < 40; pageIndex += 1) {
        fetchMock.mockResolvedValueOnce(pageResponse({ objects: fullPage, total: 1_000_000 }));
      }
      result = await discoverPackages("@x");
    });

    it("should stop after collecting 10000 results", () => {
      expect(result.length).toBe(10_000);
    });

    it("should issue exactly 40 requests (250 results each)", () => {
      expect(fetchMock).toHaveBeenCalledTimes(40);
    });
  });
});
