import type { BudgetPeriod, TokelioClient } from "@tokelio-labs/sdk";
import { formatAmount } from "@tokelio-labs/sdk";
import { getClient } from "../client.js";
import { toCleanError } from "../errors.js";
import type { BudgetEntry } from "../budgets.js";
import { loadBudgets, saveBudgets } from "../budgets.js";

const VALID_PERIODS: BudgetPeriod[] = ["session", "hourly", "daily", "weekly"];

// Tracks which agents have already had their budget configured (via
// `setBudget`) on the *current* `TokelioClient` instance during this
// process, so we hydrate a persisted budget config onto the SDK's
// in-memory `BudgetManager` at most once per agent per process. Without
// this guard, calling `budgetShow` after some spend had already happened
// in the same process (e.g. `budget set` -> `pay` -> `budget show`) would
// re-apply `setBudget`, which resets the manager's in-progress spend
// window back to zero — silently "refunding" the agent's spent budget.
const hydratedAgents = new Set<string>();

/**
 * Ensures `agentId`'s persisted budget config (if any) is applied to the
 * SDK's `BudgetManager` for the current process, at most once per agent.
 * Returns the persisted entry (if one exists) either way, so callers can
 * display the configured limit/period even though the SDK itself exposes
 * no getter for them (only `getRemainingBudget`).
 */
export async function ensureBudgetHydrated(
  agentId: string,
  client: TokelioClient,
): Promise<BudgetEntry | undefined> {
  const budgets = await loadBudgets();
  const entry = budgets[agentId];
  if (entry && !hydratedAgents.has(agentId)) {
    client.wallet(agentId).setBudget(entry.limit, entry.period);
    hydratedAgents.add(agentId);
  }
  return entry;
}

/** Test-only: forget which agents have been hydrated this process. */
export function resetBudgetHydrationCache(): void {
  hydratedAgents.clear();
}

export interface BudgetSetOptions {
  agentId: string;
  limit: string | number;
  period: BudgetPeriod;
}

export interface BudgetSetResult {
  agentId: string;
  limit: string;
  period: BudgetPeriod;
}

/** Sets (or replaces) `agentId`'s spending budget for `period`. */
export async function budgetSet(opts: BudgetSetOptions): Promise<BudgetSetResult> {
  if (!VALID_PERIODS.includes(opts.period)) {
    throw new Error(
      `Invalid budget period "${String(opts.period)}" — must be one of: ${VALID_PERIODS.join(", ")}`,
    );
  }

  try {
    const client = await getClient();
    client.wallet(opts.agentId).setBudget(opts.limit, opts.period);
    hydratedAgents.add(opts.agentId);

    const limitStr = String(opts.limit);
    const budgets = await loadBudgets();
    budgets[opts.agentId] = {
      agentId: opts.agentId,
      limit: limitStr,
      period: opts.period,
      setAt: Date.now(),
    };
    await saveBudgets(budgets);

    return { agentId: opts.agentId, limit: limitStr, period: opts.period };
  } catch (err) {
    throw toCleanError(err);
  }
}

export interface BudgetShowOptions {
  agentId: string;
}

export interface BudgetShowResult {
  agentId: string;
  limit: string | null;
  period: BudgetPeriod | null;
  remaining: string | null;
}

/** Shows `agentId`'s currently configured budget limit/period and remaining amount, if any. */
export async function budgetShow(opts: BudgetShowOptions): Promise<BudgetShowResult> {
  try {
    const client = await getClient();
    const entry = await ensureBudgetHydrated(opts.agentId, client);

    if (!entry) {
      return { agentId: opts.agentId, limit: null, period: null, remaining: null };
    }

    const remaining = client.wallet(opts.agentId).getRemainingBudget();
    return {
      agentId: opts.agentId,
      limit: entry.limit,
      period: entry.period,
      remaining: formatAmount(remaining),
    };
  } catch (err) {
    throw toCleanError(err);
  }
}
