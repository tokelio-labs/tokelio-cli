import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { BudgetPeriod } from "@tokelio-labs/sdk";
import { getBudgetsPath } from "./config.js";

/** A locally-remembered budget configuration for one agent. */
export interface BudgetEntry {
  agentId: string;
  /** Human-readable decimal limit, e.g. `"100"` — same format the SDK's `parseAmount` accepts. */
  limit: string;
  period: BudgetPeriod;
  setAt: number;
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

/** Loads all locally-remembered budget configs, keyed by agent id. Empty object if none saved yet. */
export async function loadBudgets(): Promise<Record<string, BudgetEntry>> {
  const filePath = getBudgetsPath();
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
  return parsed as Record<string, BudgetEntry>;
}

/** Overwrites `budgets.json` with the given map of budget configs. */
export async function saveBudgets(budgets: Record<string, BudgetEntry>): Promise<void> {
  const filePath = getBudgetsPath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(budgets, null, 2) + "\n", "utf8");
}
