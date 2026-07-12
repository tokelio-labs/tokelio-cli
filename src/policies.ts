import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getPoliciesPath } from "./config.js";

/**
 * A locally-remembered, process-wide spending policy configuration.
 * Unlike budgets, policies are not per-agent — the SDK's `PolicyEngine` is
 * shared across every wallet a `TokelioClient` hands out, so there's just
 * one set of configured policies at a time.
 */
export interface PolicyConfig {
  /** Human-readable decimal limit, e.g. `"100"` — same format the SDK's `parseAmount` accepts. */
  maxTransactionAmount?: string;
  payeeAllowlist?: string[];
  payeeDenylist?: string[];
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

/** Loads the locally-remembered policy config. Returns an empty object if `policies.json` doesn't exist yet. */
export async function loadPolicyConfig(): Promise<PolicyConfig> {
  const filePath = getPoliciesPath();
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if (isEnoent(err)) {
      return {};
    }
    throw err;
  }

  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  return parsed;
}

/** Overwrites `policies.json` with the given policy config. */
export async function savePolicyConfig(config: PolicyConfig): Promise<void> {
  const filePath = getPoliciesPath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2) + "\n", "utf8");
}
