import type { TransferRecord } from "@tokelio/sdk";
import { formatAmount } from "@tokelio/sdk";
import { getClient } from "../client.js";
import { toCleanError } from "../errors.js";
import { ensureBudgetHydrated } from "./budget.js";

export interface PayOptions {
  from: string;
  to: string;
  amount: string | number;
  memo?: string;
}

export interface PayResult {
  record: TransferRecord;
  amount: string;
}

/** Pays `amount` TOKE from `from` to `to`, respecting any configured budget on `from`. */
export async function pay(opts: PayOptions): Promise<PayResult> {
  try {
    const client = await getClient();
    await ensureBudgetHydrated(opts.from, client);
    const record = await client.wallet(opts.from).pay(opts.to, opts.amount, opts.memo);
    return { record, amount: formatAmount(record.amount) };
  } catch (err) {
    throw toCleanError(err);
  }
}
