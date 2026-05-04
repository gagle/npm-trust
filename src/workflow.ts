import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface WorkflowSnapshot {
  readonly hasIdTokenWrite: boolean;
  readonly setupNodeRegistryUrl: string | null;
  readonly setupNodeAlwaysAuth: boolean;
  readonly publishStepEnvAuthSecret: string | null;
}

const ID_TOKEN_WRITE_RE = /^\s*id-token:\s*write\s*$/m;
const NODE_AUTH_TOKEN_SECRET_RE = /NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets\.([A-Z_][A-Z0-9_]*)\s*\}\}/;
const SETUP_NODE_RE = /^(\s*)-\s+uses:\s+actions\/setup-node@/;
const REGISTRY_URL_RE = /^\s*registry-url:\s*(.+?)\s*$/;
const ALWAYS_AUTH_RE = /^\s*always-auth:\s*true\s*$/;

export function parseReleaseWorkflow(content: string): WorkflowSnapshot {
  const hasIdTokenWrite = ID_TOKEN_WRITE_RE.test(content);
  const authSecretMatch = NODE_AUTH_TOKEN_SECRET_RE.exec(content);
  const publishStepEnvAuthSecret = authSecretMatch ? authSecretMatch[1]! : null;

  const setupNode = parseSetupNodeBlock(content);

  return {
    hasIdTokenWrite,
    setupNodeRegistryUrl: setupNode.registryUrl,
    setupNodeAlwaysAuth: setupNode.alwaysAuth,
    publishStepEnvAuthSecret,
  };
}

function parseSetupNodeBlock(content: string): {
  registryUrl: string | null;
  alwaysAuth: boolean;
} {
  const lines = content.split("\n");
  let inBlock = false;
  let blockIndent = 0;
  let registryUrl: string | null = null;
  let alwaysAuth = false;

  for (const line of lines) {
    if (!inBlock) {
      const setupMatch = SETUP_NODE_RE.exec(line);
      if (setupMatch) {
        inBlock = true;
        blockIndent = setupMatch[1]!.length;
      }
      continue;
    }
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent <= blockIndent) {
      inBlock = false;
      continue;
    }
    const registryMatch = REGISTRY_URL_RE.exec(line);
    if (registryMatch) {
      registryUrl = stripQuotes(registryMatch[1]!);
      continue;
    }
    if (ALWAYS_AUTH_RE.test(line)) {
      alwaysAuth = true;
    }
  }

  return { registryUrl, alwaysAuth };
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export async function readReleaseWorkflow(
  cwd: string,
  workflowFile: string,
): Promise<WorkflowSnapshot | null> {
  try {
    const content = await readFile(join(cwd, ".github", "workflows", workflowFile), "utf-8");
    return parseReleaseWorkflow(content);
  } catch {
    return null;
  }
}
