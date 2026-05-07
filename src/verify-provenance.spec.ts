import { beforeEach, describe, expect, it, vi } from "vitest";

const runNpmAsyncMock = vi.fn();

vi.mock("./diff.js", () => ({
  runNpmAsync: (...args: ReadonlyArray<unknown>) => runNpmAsyncMock(...args),
}));

const {
  formatVerifyProvenanceHuman,
  formatVerifyProvenanceJson,
  verifyProvenance,
} = await import("./verify-provenance.js");

interface MockOutcome {
  readonly stdout: string;
  readonly status: number;
}

function asCaptured(stdout: string, status: number = 0): MockOutcome {
  return { stdout, status };
}

const PUBLISHED_WITH_PROVENANCE = JSON.stringify({
  version: "1.5.0",
  dist: {
    attestations: [
      { type: "https://slsa.dev/provenance/v1" },
      { type: "https://github.com/.../publish-attestation" },
    ],
  },
  time: {
    "1.5.0": "2026-04-22T10:00:00.000Z",
  },
});

const PUBLISHED_WITHOUT_PROVENANCE = JSON.stringify({
  version: "0.9.0",
  dist: {},
  time: {
    "0.9.0": "2026-01-15T08:00:00.000Z",
  },
});

const NEVER_PUBLISHED = "";

describe("verifyProvenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should classify a published-with-provenance package", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(asCaptured(PUBLISHED_WITH_PROVENANCE));
    const report = await verifyProvenance(["@x/a"]);
    expect(report.packages[0]).toEqual({
      pkg: "@x/a",
      latestVersion: "1.5.0",
      provenancePresent: true,
      attestationCount: 2,
      lastAttestationAt: "2026-04-22T10:00:00.000Z",
    });
    expect(report.summary.withProvenance).toBe(1);
  });

  it("should classify a published-without-provenance package", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(asCaptured(PUBLISHED_WITHOUT_PROVENANCE));
    const report = await verifyProvenance(["@x/b"]);
    expect(report.packages[0]).toEqual({
      pkg: "@x/b",
      latestVersion: "0.9.0",
      provenancePresent: false,
      attestationCount: 0,
      lastAttestationAt: "2026-01-15T08:00:00.000Z",
    });
    expect(report.summary.withoutProvenance).toBe(1);
  });

  it("should classify a never-published package", async () => {
    runNpmAsyncMock.mockResolvedValueOnce({ stdout: NEVER_PUBLISHED, status: 1 });
    const report = await verifyProvenance(["@x/c"]);
    expect(report.packages[0]).toEqual({
      pkg: "@x/c",
      latestVersion: null,
      provenancePresent: false,
      attestationCount: 0,
      lastAttestationAt: null,
    });
    expect(report.summary.unpublished).toBe(1);
  });

  it("should return empty extract when stdout is empty even on success exit", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(asCaptured("", 0));
    const report = await verifyProvenance(["@x/d"]);
    expect(report.packages[0]).toEqual({
      pkg: "@x/d",
      latestVersion: null,
      provenancePresent: false,
      attestationCount: 0,
      lastAttestationAt: null,
    });
  });

  it("should return empty extract when stdout is non-JSON", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(asCaptured("not json"));
    const report = await verifyProvenance(["@x/e"]);
    expect(report.packages[0]?.latestVersion).toBeNull();
  });

  it("should return empty extract when stdout is JSON but not an object", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(asCaptured("[1, 2, 3]"));
    const report = await verifyProvenance(["@x/f"]);
    expect(report.packages[0]?.latestVersion).toBeNull();
  });

  it("should return empty extract when stdout parses to literal null", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(asCaptured("null"));
    const report = await verifyProvenance(["@x/f2"]);
    expect(report.packages[0]?.latestVersion).toBeNull();
  });

  it("should handle non-array attestations as a single attestation present", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(
      asCaptured(
        JSON.stringify({
          version: "1.0.0",
          dist: { attestations: { url: "..." } },
          time: { "1.0.0": "2026-05-01T00:00:00.000Z" },
        }),
      ),
    );
    const report = await verifyProvenance(["@x/g"]);
    expect(report.packages[0]?.provenancePresent).toBe(true);
    expect(report.packages[0]?.attestationCount).toBe(1);
  });

  it("should handle missing time field gracefully", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(
      asCaptured(JSON.stringify({ version: "1.0.0", dist: {} })),
    );
    const report = await verifyProvenance(["@x/h"]);
    expect(report.packages[0]?.lastAttestationAt).toBeNull();
  });

  it("should handle dist field that is not an object", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(
      asCaptured(JSON.stringify({ version: "1.0.0", dist: "not-an-object" })),
    );
    const report = await verifyProvenance(["@x/i"]);
    expect(report.packages[0]?.provenancePresent).toBe(false);
    expect(report.packages[0]?.attestationCount).toBe(0);
  });

  it("should handle time field where the latest-version key is not a string", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(
      asCaptured(JSON.stringify({ version: "1.0.0", dist: {}, time: { "1.0.0": 12345 } })),
    );
    const report = await verifyProvenance(["@x/j"]);
    expect(report.packages[0]?.lastAttestationAt).toBeNull();
  });

  it("should aggregate multiple packages into the summary", async () => {
    runNpmAsyncMock
      .mockResolvedValueOnce(asCaptured(PUBLISHED_WITH_PROVENANCE))
      .mockResolvedValueOnce(asCaptured(PUBLISHED_WITHOUT_PROVENANCE))
      .mockResolvedValueOnce({ stdout: NEVER_PUBLISHED, status: 1 });
    const report = await verifyProvenance(["@x/a", "@x/b", "@x/c"]);
    expect(report.summary).toEqual({
      total: 3,
      withProvenance: 1,
      withoutProvenance: 1,
      unpublished: 1,
    });
  });

  it("should set schemaVersion to 1", async () => {
    runNpmAsyncMock.mockResolvedValueOnce(asCaptured(PUBLISHED_WITH_PROVENANCE));
    const report = await verifyProvenance(["@x/a"]);
    expect(report.schemaVersion).toBe(1);
  });
});

describe("formatVerifyProvenanceJson", () => {
  it("should serialize the report with 2-space indentation", () => {
    const report = {
      schemaVersion: 1 as const,
      packages: [],
      summary: { total: 0, withProvenance: 0, withoutProvenance: 0, unpublished: 0 },
    };
    const json = formatVerifyProvenanceJson(report);
    expect(json).toContain('"schemaVersion": 1');
    expect(json).toContain("  ");
  });
});

describe("formatVerifyProvenanceHuman", () => {
  it("should render a header with the total count", () => {
    const report = {
      schemaVersion: 1 as const,
      packages: [],
      summary: { total: 0, withProvenance: 0, withoutProvenance: 0, unpublished: 0 },
    };
    expect(formatVerifyProvenanceHuman(report)).toContain("0 packages");
  });

  it("should render a row per published-with-provenance package including attestation count + timestamp", () => {
    const report = {
      schemaVersion: 1 as const,
      packages: [
        {
          pkg: "@x/a",
          latestVersion: "1.5.0",
          provenancePresent: true,
          attestationCount: 2,
          lastAttestationAt: "2026-04-22T10:00:00.000Z",
        },
      ],
      summary: { total: 1, withProvenance: 1, withoutProvenance: 0, unpublished: 0 },
    };
    const human = formatVerifyProvenanceHuman(report);
    expect(human).toContain("@x/a");
    expect(human).toContain("✓");
    expect(human).toContain("1.5.0");
    expect(human).toContain("2 attestation");
    expect(human).toContain("2026-04-22T10:00:00.000Z");
  });

  it("should render published-without-provenance row with ✗", () => {
    const report = {
      schemaVersion: 1 as const,
      packages: [
        {
          pkg: "@x/b",
          latestVersion: "0.9.0",
          provenancePresent: false,
          attestationCount: 0,
          lastAttestationAt: null,
        },
      ],
      summary: { total: 1, withProvenance: 0, withoutProvenance: 1, unpublished: 0 },
    };
    const human = formatVerifyProvenanceHuman(report);
    expect(human).toContain("✗");
    expect(human).toContain("no provenance");
  });

  it("should render unpublished row with (not published)", () => {
    const report = {
      schemaVersion: 1 as const,
      packages: [
        {
          pkg: "@x/c",
          latestVersion: null,
          provenancePresent: false,
          attestationCount: 0,
          lastAttestationAt: null,
        },
      ],
      summary: { total: 1, withProvenance: 0, withoutProvenance: 0, unpublished: 1 },
    };
    expect(formatVerifyProvenanceHuman(report)).toContain("(not published)");
  });

  it("should render the per-row timestamp only when present", () => {
    const report = {
      schemaVersion: 1 as const,
      packages: [
        {
          pkg: "@x/d",
          latestVersion: "1.0.0",
          provenancePresent: true,
          attestationCount: 1,
          lastAttestationAt: null,
        },
      ],
      summary: { total: 1, withProvenance: 1, withoutProvenance: 0, unpublished: 0 },
    };
    const human = formatVerifyProvenanceHuman(report);
    expect(human).toContain("1 attestation");
    expect(human).not.toContain(", null");
  });
});
