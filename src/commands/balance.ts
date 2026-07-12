import { getClient } from "../client.js";
import { toCleanError } from "../errors.js";

export interface BalanceOptions {
  agentId: string;
}

export interface BalanceResult {
  agentId: string;
  balance: string;
}

/** Returns `agentId`'s current balance, formatted as a human-readable TOKE amount. */
export async function balance(opts: BalanceOptions): Promise<BalanceResult> {
  try {
    const client = await getClient();
    const formatted = await client.wallet(opts.agentId).checkBalanceFormatted();
    return { agentId: opts.agentId, balance: formatted };
  } catch (err) {
    throw toCleanError(err);
  }
}
