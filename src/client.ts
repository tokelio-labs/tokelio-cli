import {
  FileLedgerAdapter,
  PolicyEngine,
  TokelioClient,
  maxTransactionAmount,
  parseAmount,
  payeeAllowlist,
  payeeDenylist,
} from "@tokelio-labs/sdk";
import type { SpendingPolicy } from "@tokelio-labs/sdk";
import { ensureTokelioHome, getLedgerPath } from "./config.js";
import type { PolicyConfig } from "./policies.js";
import { loadPolicyConfig } from "./policies.js";

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
 * Builds a `PolicyEngine` from the locally-persisted policy config (see
 * `src/policies.ts`), or `undefined` if nothing is configured. This is the
 * same hydration idea `src/commands/budget.ts` uses for budgets — the SDK's
 * `PolicyEngine` is in-memory-only, so the CLI re-applies its own persisted
 * config every time a fresh `TokelioClient` is built, which is what makes
 * `policy set-max-transaction`/`policy allow`/`policy deny` survive across
 * separate CLI invocations (each `tokelio` command is its own process).
 */
function buildPolicyEngine(config: PolicyConfig): PolicyEngine | undefined {
  const policies: SpendingPolicy[] = [];

  if (config.maxTransactionAmount !== undefined) {
    policies.push(maxTransactionAmount(parseAmount(config.maxTransactionAmount)));
  }
  if (config.payeeAllowlist !== undefined) {
    policies.push(payeeAllowlist(config.payeeAllowlist));
  }
  if (config.payeeDenylist !== undefined) {
    policies.push(payeeDenylist(config.payeeDenylist));
  }

  return policies.length > 0 ? new PolicyEngine(policies) : undefined;
}

/**
 * Returns the process-wide `TokelioClient`, creating it (and the Tokelio
 * home directory) on first use. Backed by a `FileLedgerAdapter` pointed at
 * `getLedgerPath()`, and a `PolicyEngine` hydrated from any persisted
 * `policy set-max-transaction`/`policy allow`/`policy deny` config.
 *
 * Because the client (and the `PolicyEngine` baked into it) is memoized for
 * the lifetime of this cache, a policy change made mid-process (as in
 * tests, which run many commands in one process) is only picked up by
 * wallets created *after* the next `resetClientCache()` — exactly like
 * budgets, real CLI invocations never need to worry about this since every
 * `tokelio` command is its own fresh process.
 */
export async function getClient(): Promise<TokelioClient> {
  await ensureTokelioHome();
  const ledgerPath = getLedgerPath();

  if (!cachedClient || cachedLedgerPath !== ledgerPath) {
    const policyConfig = await loadPolicyConfig();
    const policyEngine = buildPolicyEngine(policyConfig);
    cachedClient = new TokelioClient({
      adapter: new FileLedgerAdapter(ledgerPath),
      ...(policyEngine !== undefined ? { policyEngine } : {}),
    });
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
