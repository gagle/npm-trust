import { runNpmAsync, type CapturedRun } from "./diff.js";
import type {
  ProvenanceEntry,
  VerifyProvenanceReport,
} from "./interfaces/cli.interface.js";

interface NpmViewExtract {
  readonly latestVersion: string | null;
  readonly provenancePresent: boolean;
  readonly attestationCount: number;
  readonly lastAttestationAt: string | null;
}

const EMPTY_EXTRACT: NpmViewExtract = {
  latestVersion: null,
  provenancePresent: false,
  attestationCount: 0,
  lastAttestationAt: null,
};

function parseNpmViewBulk(captured: CapturedRun): NpmViewExtract {
  if (captured.status !== 0) {
    return EMPTY_EXTRACT;
  }
  const trimmed = captured.stdout.trim();
  if (trimmed === "") {
    return EMPTY_EXTRACT;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return EMPTY_EXTRACT;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return EMPTY_EXTRACT;
  }
  const root = parsed as Record<string, unknown>;
  const latestVersion = typeof root["version"] === "string" ? root["version"] : null;

  const dist = root["dist"];
  const distAttestations =
    typeof dist === "object" && dist !== null && "attestations" in dist
      ? (dist as Record<string, unknown>)["attestations"]
      : null;
  const provenancePresent = distAttestations !== null && distAttestations !== undefined;
  const attestationCount = Array.isArray(distAttestations)
    ? distAttestations.length
    : provenancePresent
      ? 1
      : 0;

  let lastAttestationAt: string | null = null;
  const time = root["time"];
  if (typeof time === "object" && time !== null && latestVersion !== null) {
    const value = (time as Record<string, unknown>)[latestVersion];
    if (typeof value === "string") {
      lastAttestationAt = value;
    }
  }

  return { latestVersion, provenancePresent, attestationCount, lastAttestationAt };
}

async function verifyOnePackage(pkg: string): Promise<ProvenanceEntry> {
  const captured = await runNpmAsync(["view", pkg, "version", "dist", "time", "--json"]);
  const extract = parseNpmViewBulk(captured);
  return {
    pkg,
    latestVersion: extract.latestVersion,
    provenancePresent: extract.provenancePresent,
    attestationCount: extract.attestationCount,
    lastAttestationAt: extract.lastAttestationAt,
  };
}

export async function verifyProvenance(
  packages: ReadonlyArray<string>,
): Promise<VerifyProvenanceReport> {
  const results = await Promise.all(packages.map(verifyOnePackage));
  let withProvenance = 0;
  let withoutProvenance = 0;
  let unpublished = 0;
  for (const r of results) {
    if (r.latestVersion === null) {
      unpublished++;
    } else if (r.provenancePresent) {
      withProvenance++;
    } else {
      withoutProvenance++;
    }
  }
  return {
    schemaVersion: 1,
    packages: results,
    summary: {
      total: results.length,
      withProvenance,
      withoutProvenance,
      unpublished,
    },
  };
}

export function formatVerifyProvenanceJson(report: VerifyProvenanceReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatVerifyProvenanceHuman(report: VerifyProvenanceReport): string {
  const lines: Array<string> = [];
  lines.push(`Provenance check — ${report.summary.total} packages`);
  lines.push(
    `  ${report.summary.withProvenance} with provenance, ${report.summary.withoutProvenance} without, ${report.summary.unpublished} unpublished`,
  );
  lines.push("");
  for (const entry of report.packages) {
    const label = entry.pkg.padEnd(30);
    if (entry.latestVersion === null) {
      lines.push(`${label} (not published)`);
    } else if (entry.provenancePresent) {
      lines.push(
        `${label} ✓ ${entry.latestVersion} (${entry.attestationCount} attestation(s)${entry.lastAttestationAt ? `, ${entry.lastAttestationAt}` : ""})`,
      );
    } else {
      lines.push(`${label} ✗ ${entry.latestVersion} (no provenance)`);
    }
  }
  return lines.join("\n");
}
