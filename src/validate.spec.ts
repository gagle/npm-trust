import { beforeEach, describe, expect, it, vi } from "vitest";

const inspectAuthMock = vi.fn();
const inspectRepoMock = vi.fn();
const readReleaseWorkflowMock = vi.fn();

vi.mock("./doctor.js", () => ({
  inspectAuth: () => inspectAuthMock(),
  inspectRepo: (...args: ReadonlyArray<unknown>) => inspectRepoMock(...args),
}));

vi.mock("./workflow.js", () => ({
  readReleaseWorkflow: (...args: ReadonlyArray<unknown>) => readReleaseWorkflowMock(...args),
}));

const {
  collectValidateReport,
  formatValidateReportHuman,
  formatValidateReportJson,
  runValidate,
} = await import("./validate.js");

interface CapturingLogger {
  readonly log: (message: string) => void;
  readonly logs: ReadonlyArray<string>;
}

function createLogger(): CapturingLogger {
  const logs: Array<string> = [];
  return { log: (m) => logs.push(m), logs };
}

const HEALTHY_AUTH = { loggedIn: true, username: "gagle", registry: "https://registry.npmjs.org" };
const HEALTHY_REPO = {
  url: "https://github.com/gagle/foo",
  inferredSlug: "gagle/foo",
  host: "github" as const,
};
const HEALTHY_WORKFLOW = {
  hasIdTokenWrite: true,
  setupNodeRegistryUrl: "https://registry.npmjs.org",
  setupNodeAlwaysAuth: false,
  publishStepEnvAuthSecret: null,
};

describe("collectValidateReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return ready=true when all checks pass", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    readReleaseWorkflowMock.mockResolvedValueOnce(HEALTHY_WORKFLOW);
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect(report.ready).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.schemaVersion).toBe(1);
  });

  it("should record auth failure when not logged in", async () => {
    inspectAuthMock.mockReturnValueOnce({ ...HEALTHY_AUTH, loggedIn: false, username: null });
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    readReleaseWorkflowMock.mockResolvedValueOnce(HEALTHY_WORKFLOW);
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect(report.ready).toBe(false);
    expect(report.failures.some((f) => f.includes("npm not logged in"))).toBe(true);
  });

  it("should record workflow-not-found when readReleaseWorkflow returns null", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    readReleaseWorkflowMock.mockResolvedValueOnce(null);
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect(report.ready).toBe(false);
    expect(report.failures.some((f) => f.includes("workflow file not found"))).toBe(true);
    expect("found" in report.workflow && report.workflow.found === false).toBe(true);
  });

  it("should record workflow check failure when --workflow flag absent", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      logger: createLogger(),
    });
    expect(report.ready).toBe(false);
    expect(report.failures.some((f) => f.includes("no --workflow specified"))).toBe(true);
    expect(readReleaseWorkflowMock).not.toHaveBeenCalled();
  });

  it("should record workflow check failure when --workflow flag is empty string", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      workflow: "",
      logger: createLogger(),
    });
    expect(report.ready).toBe(false);
  });

  it("should fail when workflow lacks id-token: write", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    readReleaseWorkflowMock.mockResolvedValueOnce({ ...HEALTHY_WORKFLOW, hasIdTokenWrite: false });
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect(report.ready).toBe(false);
    expect(report.failures.some((f) => f.includes("id-token: write"))).toBe(true);
  });

  it("should fail when repo host is not github", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce({ ...HEALTHY_REPO, host: "other" });
    readReleaseWorkflowMock.mockResolvedValueOnce(HEALTHY_WORKFLOW);
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect(report.ready).toBe(false);
    expect(report.failures.some((f) => f.includes("not GitHub"))).toBe(true);
  });

  it("should fail when repo host is null (no remote)", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce({ ...HEALTHY_REPO, host: null });
    readReleaseWorkflowMock.mockResolvedValueOnce(HEALTHY_WORKFLOW);
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect(report.ready).toBe(false);
  });

  it("should aggregate multiple failures", async () => {
    inspectAuthMock.mockReturnValueOnce({ ...HEALTHY_AUTH, loggedIn: false, username: null });
    inspectRepoMock.mockReturnValueOnce({ ...HEALTHY_REPO, host: "other" });
    readReleaseWorkflowMock.mockResolvedValueOnce({ ...HEALTHY_WORKFLOW, hasIdTokenWrite: false });
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect(report.ready).toBe(false);
    expect(report.failures.length).toBeGreaterThanOrEqual(3);
  });

  it("should populate the workflow snapshot fields when present", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    readReleaseWorkflowMock.mockResolvedValueOnce(HEALTHY_WORKFLOW);
    const report = await collectValidateReport({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect("found" in report.workflow).toBe(false);
    if (!("found" in report.workflow)) {
      expect(report.workflow.file).toBe("release.yml");
      expect(report.workflow.hasIdTokenWrite).toBe(true);
    }
  });
});

describe("runValidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 0 on ready=true", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    readReleaseWorkflowMock.mockResolvedValueOnce(HEALTHY_WORKFLOW);
    const exitCode = await runValidate({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect(exitCode).toBe(0);
  });

  it("should return 1 on ready=false", async () => {
    inspectAuthMock.mockReturnValueOnce({ ...HEALTHY_AUTH, loggedIn: false, username: null });
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    readReleaseWorkflowMock.mockResolvedValueOnce(HEALTHY_WORKFLOW);
    const exitCode = await runValidate({
      cwd: "/tmp/x",
      workflow: "release.yml",
      logger: createLogger(),
    });
    expect(exitCode).toBe(1);
  });

  it("should emit JSON when json=true", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    readReleaseWorkflowMock.mockResolvedValueOnce(HEALTHY_WORKFLOW);
    const logger = createLogger();
    await runValidate({ cwd: "/tmp/x", workflow: "release.yml", json: true, logger });
    expect(logger.logs[0]).toContain('"schemaVersion": 1');
  });

  it("should emit human format when json=false (default)", async () => {
    inspectAuthMock.mockReturnValueOnce(HEALTHY_AUTH);
    inspectRepoMock.mockReturnValueOnce(HEALTHY_REPO);
    readReleaseWorkflowMock.mockResolvedValueOnce(HEALTHY_WORKFLOW);
    const logger = createLogger();
    await runValidate({ cwd: "/tmp/x", workflow: "release.yml", logger });
    expect(logger.logs[0]).toContain("npm-trust validate");
  });
});

describe("formatValidateReportJson", () => {
  it("should serialize with 2-space indentation", () => {
    const report = {
      schemaVersion: 1 as const,
      workflow: { found: false as const, error: "test" },
      repo: { url: null, inferredSlug: null, host: null },
      auth: { loggedIn: false, username: null, registry: "x" },
      ready: false,
      failures: ["x"],
    };
    expect(formatValidateReportJson(report)).toContain('"schemaVersion": 1');
  });
});

describe("formatValidateReportHuman", () => {
  it("should render READY when ready=true", () => {
    const report = {
      schemaVersion: 1 as const,
      workflow: {
        file: "release.yml",
        hasIdTokenWrite: true,
        setupNodeRegistryUrl: "x",
        setupNodeAlwaysAuth: false,
        publishStepEnvAuthSecret: null,
      },
      repo: { url: "x", inferredSlug: "o/r", host: "github" as const },
      auth: { loggedIn: true, username: "u", registry: "x" },
      ready: true,
      failures: [] as ReadonlyArray<string>,
    };
    expect(formatValidateReportHuman(report)).toContain("READY");
  });

  it("should render NOT READY when ready=false and list failures", () => {
    const report = {
      schemaVersion: 1 as const,
      workflow: { found: false as const, error: "missing file" },
      repo: { url: null, inferredSlug: null, host: null },
      auth: { loggedIn: false, username: null, registry: "x" },
      ready: false,
      failures: ["a", "b"],
    };
    const human = formatValidateReportHuman(report);
    expect(human).toContain("NOT READY");
    expect(human).toContain("Failures:");
    expect(human).toContain("- a");
    expect(human).toContain("- b");
  });

  it("should mark workflow not-found", () => {
    const report = {
      schemaVersion: 1 as const,
      workflow: { found: false as const, error: "missing" },
      repo: { url: null, inferredSlug: null, host: null },
      auth: { loggedIn: false, username: null, registry: "x" },
      ready: false,
      failures: [],
    };
    const human = formatValidateReportHuman(report);
    expect(human).toContain("✗ workflow");
    expect(human).toContain("missing");
  });

  it("should mark workflow with id-token: write missing", () => {
    const report = {
      schemaVersion: 1 as const,
      workflow: {
        file: "release.yml",
        hasIdTokenWrite: false,
        setupNodeRegistryUrl: "x",
        setupNodeAlwaysAuth: false,
        publishStepEnvAuthSecret: null,
      },
      repo: { url: "x", inferredSlug: "o/r", host: "github" as const },
      auth: { loggedIn: true, username: "u", registry: "x" },
      ready: false,
      failures: ["workflow missing id-token"],
    };
    const human = formatValidateReportHuman(report);
    expect(human).toContain("MISSING");
  });

  it("should render '(unknown)' username when loggedIn but username is null", () => {
    const report = {
      schemaVersion: 1 as const,
      workflow: { found: false as const, error: "x" },
      repo: { url: null, inferredSlug: null, host: null },
      auth: { loggedIn: true, username: null, registry: "x" },
      ready: false,
      failures: [],
    };
    expect(formatValidateReportHuman(report)).toContain("(unknown)");
  });

  it("should render '(unknown)' inferredSlug when null", () => {
    const report = {
      schemaVersion: 1 as const,
      workflow: { found: false as const, error: "x" },
      repo: { url: null, inferredSlug: null, host: null },
      auth: { loggedIn: false, username: null, registry: "x" },
      ready: false,
      failures: [],
    };
    expect(formatValidateReportHuman(report)).toContain("(unknown)");
  });
});
