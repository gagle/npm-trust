export interface CliOptions {
  readonly scope?: string;
  readonly packages?: ReadonlyArray<string>;
  readonly repo?: string;
  readonly workflow?: string;
  readonly list?: boolean;
  readonly dryRun?: boolean;
  readonly auto?: boolean;
  readonly onlyNew?: boolean;
  readonly doctor?: boolean;
  readonly json?: boolean;
  readonly emitWorkflow?: boolean;
  readonly verifyProvenance?: boolean;
  readonly validateOnly?: boolean;
  readonly capabilities?: boolean;
  readonly withPrepareDist?: boolean;
}

export interface CapabilitiesFlag {
  readonly name: string;
  readonly type: "boolean" | "string" | "string-array";
}

export interface CapabilitiesJsonSchema {
  readonly flag: string;
  readonly schema: string;
  readonly version: number;
}

export interface CapabilitiesExitCode {
  readonly code: number;
  readonly name: string;
}

export interface CapabilitiesReport {
  readonly schemaVersion: 1;
  readonly name: "npm-trust";
  readonly version: string;
  readonly features: ReadonlyArray<string>;
  readonly flags: ReadonlyArray<CapabilitiesFlag>;
  readonly jsonSchemas: ReadonlyArray<CapabilitiesJsonSchema>;
  readonly exitCodes: ReadonlyArray<CapabilitiesExitCode>;
}

export interface WorkflowSnapshotReport {
  readonly file: string;
  readonly fileHash: string;
  readonly hasIdTokenWrite: boolean;
  readonly setupNodeRegistryUrl: string | null;
  readonly setupNodeAlwaysAuth: boolean;
  readonly publishStepEnvAuthSecret: string | null;
}

export interface ValidateReport {
  readonly schemaVersion: 1;
  readonly workflow: WorkflowSnapshotReport | { readonly found: false; readonly error: string };
  readonly repo: {
    readonly url: string | null;
    readonly inferredSlug: string | null;
    readonly host: RepoHost;
  };
  readonly auth: {
    readonly loggedIn: boolean;
    readonly username: string | null;
    readonly registry: string;
  };
  readonly ready: boolean;
  readonly failures: ReadonlyArray<string>;
}

export interface ProvenanceEntry {
  readonly pkg: string;
  readonly latestVersion: string | null;
  readonly provenancePresent: boolean;
  readonly attestationCount: number;
  readonly lastAttestationAt: string | null;
  readonly unpackedSize?: number;
}

export interface VerifyProvenanceReport {
  readonly schemaVersion: 1 | 2;
  readonly packages: ReadonlyArray<ProvenanceEntry>;
  readonly summary: {
    readonly total: number;
    readonly withProvenance: number;
    readonly withoutProvenance: number;
    readonly unpublished: number;
  };
}

export type WorkspaceSource = "pnpm-workspace" | "npm-workspace" | "single-package";

export interface DiscoveredWorkspace {
  readonly source: WorkspaceSource;
  readonly packages: ReadonlyArray<string>;
}

export interface PackageStatus {
  readonly pkg: string;
  readonly trustConfigured: boolean;
  readonly published: boolean;
  readonly hasProvenance: boolean;
}

export type DoctorIssueSeverity = "warn" | "fail";

export type DoctorIssueCode =
  | "NODE_TOO_OLD"
  | "NPM_TOO_OLD"
  | "NPM_UNREACHABLE"
  | "AUTH_NOT_LOGGED_IN"
  | "AUTH_REGISTRY_UNUSUAL"
  | "WORKSPACE_NOT_DETECTED"
  | "WORKSPACE_EMPTY"
  | "REPO_NO_REMOTE"
  | "REPO_REMOTE_NOT_GITHUB"
  | "WORKFLOWS_NONE"
  | "WORKFLOWS_AMBIGUOUS"
  | "WORKFLOW_NOT_FOUND"
  | "PACKAGE_TRUST_DISCREPANCY"
  | "PACKAGE_NOT_PUBLISHED"
  | "REGISTRY_UNREACHABLE"
  | "REGISTRY_PROVENANCE_CONFLICT"
  | "WORKFLOW_AUTH_MISMATCH"
  | "NPMRC_REGISTRY_DIVERGES"
  | "NPMRC_LITERAL_TOKEN"
  | "WORKFLOW_MISSING_AUTH_SECRET"
  | "DOCTOR_FLAG_IGNORED";

export interface DoctorIssue {
  readonly severity: DoctorIssueSeverity;
  readonly code: DoctorIssueCode;
  readonly message: string;
  readonly remedy?: string;
  readonly relatedField?: string;
}

export interface VersionCheck {
  readonly version: string | null;
  readonly required: string;
  readonly satisfies: boolean;
}

export type RepoHost = "github" | "other" | null;

export interface PackageDoctorEntry extends PackageStatus {
  readonly discrepancies: ReadonlyArray<string>;
  readonly latestVersion?: string;
  readonly lastSuccessfulPublish?: string;
  readonly unpackedSize?: number;
  readonly perPackageIssueCodes: ReadonlyArray<DoctorIssueCode>;
}

export interface DoctorReport {
  readonly schemaVersion: 1 | 2;
  readonly workflowSnapshot?: WorkflowSnapshotReport;
  readonly cli: {
    readonly version: string;
    readonly path: string;
  };
  readonly runtime: {
    readonly node: VersionCheck;
    readonly npm: VersionCheck;
    readonly platform: string;
  };
  readonly auth: {
    readonly loggedIn: boolean;
    readonly username: string | null;
    readonly registry: string;
  };
  readonly workspace: DiscoveredWorkspace | null;
  readonly repo: {
    readonly url: string | null;
    readonly inferredSlug: string | null;
    readonly host: RepoHost;
  };
  readonly workflows: ReadonlyArray<string>;
  readonly packages: ReadonlyArray<PackageDoctorEntry>;
  readonly issues: ReadonlyArray<DoctorIssue>;
  readonly summary: {
    readonly ok: number;
    readonly warn: number;
    readonly fail: number;
  };
}

export type TrustResult = "configured" | "already" | "not_published" | "auth_failed" | "error";

export interface TrustSummary {
  readonly configured: number;
  readonly already: number;
  readonly failed: number;
  readonly failedPackages: ReadonlyArray<string>;
}

export interface ConfigureTrustOptions {
  readonly packages: ReadonlyArray<string>;
  readonly repo: string;
  readonly workflow: string;
  readonly dryRun?: boolean;
  readonly json?: boolean;
  readonly logger?: Logger;
}

export interface ListTrustOptions {
  readonly packages: ReadonlyArray<string>;
  readonly json?: boolean;
  readonly logger?: Logger;
}

export interface ListReportEntry {
  readonly pkg: string;
  readonly trustConfigured: boolean;
  readonly raw: string;
}

export interface ListReport {
  readonly schemaVersion: 1;
  readonly packages: ReadonlyArray<ListReportEntry>;
}

export type ConfigureEntryResult = TrustResult | "dry_run";

export interface ConfigureReportEntry {
  readonly pkg: string;
  readonly result: ConfigureEntryResult;
}

export interface ConfigureReport {
  readonly schemaVersion: 1;
  readonly summary: TrustSummary;
  readonly entries: ReadonlyArray<ConfigureReportEntry>;
}

export interface Logger {
  readonly log: (message: string) => void;
}

export interface RuntimeLogger extends Logger {
  readonly error: (message: string) => void;
}
