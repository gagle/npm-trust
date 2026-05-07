import { inspectAuth, inspectRepo } from "./doctor.js";
import type { Logger, ValidateReport } from "./interfaces/cli.interface.js";
import { readReleaseWorkflow } from "./workflow.js";

export interface RunValidateOptions {
  readonly cwd: string;
  readonly workflow?: string;
  readonly json?: boolean;
  readonly logger: Logger;
}

export async function runValidate(options: RunValidateOptions): Promise<number> {
  const report = await collectValidateReport(options);
  const output = options.json
    ? formatValidateReportJson(report)
    : formatValidateReportHuman(report);
  options.logger.log(output);
  return report.ready ? 0 : 1;
}

export async function collectValidateReport(
  options: RunValidateOptions,
): Promise<ValidateReport> {
  const auth = inspectAuth();
  const repo = inspectRepo(options.cwd);

  const workflowFile = options.workflow;
  let workflow: ValidateReport["workflow"];
  if (workflowFile === undefined || workflowFile === "") {
    workflow = { found: false, error: "no --workflow specified" };
  } else {
    const snapshot = await readReleaseWorkflow(options.cwd, workflowFile);
    if (snapshot === null) {
      workflow = { found: false, error: `workflow file not found: ${workflowFile}` };
    } else {
      workflow = {
        file: workflowFile,
        hasIdTokenWrite: snapshot.hasIdTokenWrite,
        setupNodeRegistryUrl: snapshot.setupNodeRegistryUrl,
        setupNodeAlwaysAuth: snapshot.setupNodeAlwaysAuth,
        publishStepEnvAuthSecret: snapshot.publishStepEnvAuthSecret,
      };
    }
  }

  const failures: Array<string> = [];

  if (!auth.loggedIn) {
    failures.push("npm not logged in (run `npm login`)");
  }

  if ("found" in workflow) {
    failures.push(`workflow check: ${workflow.error}`);
  } else if (!workflow.hasIdTokenWrite) {
    failures.push("workflow missing `id-token: write` permission (required for OIDC)");
  }

  if (repo.host !== "github") {
    failures.push("git remote is not GitHub (OIDC trust requires a GitHub repository)");
  }

  return {
    schemaVersion: 1,
    workflow,
    repo,
    auth,
    ready: failures.length === 0,
    failures,
  };
}

export function formatValidateReportJson(report: ValidateReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatValidateReportHuman(report: ValidateReport): string {
  const lines: Array<string> = [];
  lines.push(`npm-trust validate — ${report.ready ? "READY" : "NOT READY"}`);
  lines.push("");
  lines.push(
    `  ${marker(report.auth.loggedIn)} npm auth   ${report.auth.loggedIn ? `as ${report.auth.username ?? "(unknown)"}` : "not logged in"}`,
  );
  lines.push(
    `  ${marker(report.repo.host === "github")} repo       ${report.repo.inferredSlug ?? "(unknown)"} (host: ${report.repo.host ?? "none"})`,
  );
  if ("found" in report.workflow) {
    lines.push(`  ✗ workflow   ${report.workflow.error}`);
  } else {
    lines.push(
      `  ${marker(report.workflow.hasIdTokenWrite)} workflow   ${report.workflow.file} (id-token: ${report.workflow.hasIdTokenWrite ? "write" : "MISSING"})`,
    );
  }
  if (report.failures.length > 0) {
    lines.push("");
    lines.push("Failures:");
    for (const failure of report.failures) {
      lines.push(`  - ${failure}`);
    }
  }
  return lines.join("\n");
}

function marker(ok: boolean): string {
  return ok ? "✓" : "✗";
}
