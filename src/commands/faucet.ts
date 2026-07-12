import { formatAmount, parseAmount } from "@tokelio-labs/sdk";
import { getClient } from "../client.js";
import { toCleanError } from "../errors.js";

export interface FaucetOptions {
  agentId: string;
  amount: string | number;
}

export interface FaucetResult {
  agentId: string;
  funded: string;
  balance: string;
}

/** Mints `amount` TOKE into `agentId`'s balance (a faucet, for local dev/testing). */
export async function faucet(opts: FaucetOptions): Promise<FaucetResult> {
  try {
    const client = await getClient();
    const wallet = client.wallet(opts.agentId);
    const funded = formatAmount(parseAmount(opts.amount));
    await wallet.fund(opts.amount);
    const balance = await wallet.checkBalanceFormatted();
    return { agentId: opts.agentId, funded, balance };
  } catch (err) {
    throw toCleanError(err);
  }
}
