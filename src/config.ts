import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Root directory for all local Tokelio CLI state (wallets, ledger, budget
 * config). Defaults to `~/.tokelio`, overridable via the `TOKELIO_HOME`
 * environment variable — critical for tests, which must always point this
 * at a throwaway temp directory rather than the real home directory.
 */
export function getTokelioHome(): string {
  const override = process.env["TOKELIO_HOME"];
  if (override && override.trim().length > 0) {
    return override;
  }
  return path.join(os.homedir(), ".tokelio");
}

/** Path to the JSON file tracking known wallets (agent ids known to this CLI). */
export function getWalletsPath(): string {
  return path.join(getTokelioHome(), "wallets.json");
}

/** Path to the JSON file the SDK's `FileLedgerAdapter` persists balances/transfers to. */
export function getLedgerPath(): string {
  return path.join(getTokelioHome(), "ledger.json");
}

/**
 * Path to the JSON file tracking configured budgets (limit + period) per
 * agent. Not part of the SDK's own persisted state — the SDK's
 * `BudgetManager` only lives in memory for the lifetime of a `TokelioClient`
 * instance and exposes no getter for the configured limit/period, only the
 * remaining amount — so the CLI keeps its own record purely so `budget show`
 * has something to display and `budget set` survives across separate CLI
 * invocations (each `tokelio` command runs as its own process).
 */
export function getBudgetsPath(): string {
  return path.join(getTokelioHome(), "budgets.json");
}

/** Ensures the Tokelio home directory exists, creating it (and parents) if needed. */
export async function ensureTokelioHome(): Promise<void> {
  await mkdir(getTokelioHome(), { recursive: true });
}
