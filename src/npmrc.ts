import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface NpmrcAuthRef {
  readonly host: string;
  readonly value: string;
  readonly lineNumber: number;
  readonly isLiteral: boolean;
}

export interface NpmrcScopeMapping {
  readonly scope: string;
  readonly registry: string;
}

export interface NpmrcSnapshot {
  readonly registry: string | null;
  readonly scopes: ReadonlyArray<NpmrcScopeMapping>;
  readonly authRefs: ReadonlyArray<NpmrcAuthRef>;
}

const SCOPE_REGISTRY_RE = /^(@[a-z0-9][a-z0-9-_.]*):registry\s*=\s*(.+?)\s*$/i;
const REGISTRY_RE = /^registry\s*=\s*(.+?)\s*$/i;
const AUTH_TOKEN_RE = /^(\/\/[^:]+\/):_authToken\s*=\s*(.+?)\s*$/;
const ENV_REF_RE = /^\$\{[A-Z_][A-Z0-9_]*\}$/;

export function parseNpmrc(content: string): NpmrcSnapshot {
  let registry: string | null = null;
  const scopes: Array<NpmrcScopeMapping> = [];
  const authRefs: Array<NpmrcAuthRef> = [];

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed === "" || trimmed.startsWith(";") || trimmed.startsWith("#")) {
      continue;
    }
    const scopeMatch = SCOPE_REGISTRY_RE.exec(trimmed);
    if (scopeMatch) {
      scopes.push({ scope: scopeMatch[1]!, registry: scopeMatch[2]! });
      continue;
    }
    const registryMatch = REGISTRY_RE.exec(trimmed);
    if (registryMatch) {
      registry = registryMatch[1]!;
      continue;
    }
    const authMatch = AUTH_TOKEN_RE.exec(trimmed);
    if (authMatch) {
      const value = authMatch[2]!;
      authRefs.push({
        host: authMatch[1]!,
        value,
        lineNumber: i + 1,
        isLiteral: !ENV_REF_RE.test(value),
      });
    }
  }

  return { registry, scopes, authRefs };
}

export async function readNpmrc(cwd: string): Promise<NpmrcSnapshot | null> {
  try {
    const content = await readFile(join(cwd, ".npmrc"), "utf-8");
    return parseNpmrc(content);
  } catch {
    return null;
  }
}
