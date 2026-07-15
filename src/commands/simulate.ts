import type { BudgetSimResult } from "@tokelio-labs/sdk";
import { simulateAgentBudget } from "@tokelio-labs/sdk";
import { toCleanError } from "../errors.js";

export interface SimulateOptions {
  budget: number;
  tasks?: number | undefined;
  computePerTask?: number | undefined;
  dataPerTask?: number | undefined;
  feeRate?: number | undefined;
}

/**
 * Forecasts how far a TOKE budget stretches across autonomous-agent tasks,
 * using the SDK's deterministic `simulateAgentBudget` model — the same engine
 * behind the Tokelio dApp's Simulator. Read-only: it never touches the ledger
 * or any wallet, so it needs no persisted state and moves no funds.
 *
 * Returns the full {@link BudgetSimResult} (including the per-task `steps`
 * ledger) so `--json` consumers get everything; the human renderer in
 * `cli.ts` summarizes it and only prints the step table on request.
 */
export function simulate(opts: SimulateOptions): BudgetSimResult {
  try {
    return simulateAgentBudget({
      budget: opts.budget,
      ...(opts.tasks !== undefined ? { tasks: opts.tasks } : {}),
      ...(opts.computePerTask !== undefined ? { computePerTask: opts.computePerTask } : {}),
      ...(opts.dataPerTask !== undefined ? { dataPerTask: opts.dataPerTask } : {}),
      ...(opts.feeRate !== undefined ? { feeRate: opts.feeRate } : {}),
    });
  } catch (err) {
    throw toCleanError(err);
  }
}
