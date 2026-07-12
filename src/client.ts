import { FileLedgerAdapter, TokelioClient } from "@tokelio/sdk";
import { ensureTokelioHome, getLedgerPath } from "./config.js";

// Memoized per resolved ledger path (rather than a bare singleton) so that
// switching `TOKELIO_HOME` — as every test does, via a fresh `mkdtemp` dir
// per test — transparently gets a fresh `TokelioClient` instead of reusing
// one built against a different, stale ledger path.
//
// Reusing the same `TokelioClient` for repeat calls within one process
// matters beyond convenience: `TokelioClient.wallet(agentId)` memoizes
// `AgentWallet`s and shares one `BudgetManager` across them, and
// `TokelioClient.escrow()` memoizes a single `EscrowClient` whose task
// records live only in memory. Constructing a new `TokelioClient` on every
// call would silently reset budget windows and "forget" escrow tasks that
// were created moments earlier in the same command's process.
let cachedClient: TokelioClient | undefined;
let cachedLedgerPath: string | undefined;

/**
 * Returns the process-wide `TokelioClient`, creating it (and the Tokelio
 * home directory) on first use. Backed by a `FileLedgerAdapter` pointed at
 * `getLedgerPath()`.
 */
export async function getClient(): Promise<TokelioClient> {
  await ensureTokelioHome();
  const ledgerPath = getLedgerPath();

  if (!cachedClient || cachedLedgerPath !== ledgerPath) {
    cachedClient = new TokelioClient({ adapter: new FileLedgerAdapter(ledgerPath) });
    cachedLedgerPath = ledgerPath;
  }

  return cachedClient;
}

/**
 * Test-only escape hatch: forces the next `getClient()` call to construct a
 * brand new client even if `TOKELIO_HOME` hasn't changed. Real CLI
 * invocations never need this — each `tokelio` command is its own process.
 */
export function resetClientCache(): void {
  cachedClient = undefined;
  cachedLedgerPath = undefined;
}
