import type { PolicyConfig } from "../policies.js";
import { loadPolicyConfig, savePolicyConfig } from "../policies.js";

export interface PolicyConfigResult {
  config: PolicyConfig;
}

export interface PolicySetMaxTransactionOptions {
  limit: string | number;
}

/** Sets (or replaces) the max-transaction-amount spending policy. */
export async function policySetMaxTransaction(
  opts: PolicySetMaxTransactionOptions,
): Promise<PolicyConfigResult> {
  const config = await loadPolicyConfig();
  config.maxTransactionAmount = String(opts.limit);
  await savePolicyConfig(config);
  return { config };
}

export interface PolicyAllowOptions {
  agentIds: string[];
}

/** Sets (or replaces) the payee allowlist. */
export async function policyAllow(opts: PolicyAllowOptions): Promise<PolicyConfigResult> {
  const config = await loadPolicyConfig();
  config.payeeAllowlist = [...opts.agentIds];
  await savePolicyConfig(config);
  return { config };
}

export interface PolicyDenyOptions {
  agentIds: string[];
}

/** Sets (or replaces) the payee denylist. */
export async function policyDeny(opts: PolicyDenyOptions): Promise<PolicyConfigResult> {
  const config = await loadPolicyConfig();
  config.payeeDenylist = [...opts.agentIds];
  await savePolicyConfig(config);
  return { config };
}

/** Shows the currently configured spending policies. */
export async function policyShow(): Promise<PolicyConfigResult> {
  const config = await loadPolicyConfig();
  return { config };
}

/** Clears all configured spending policies. */
export async function policyClear(): Promise<PolicyConfigResult> {
  const config: PolicyConfig = {};
  await savePolicyConfig(config);
  return { config };
}
