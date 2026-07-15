import type { CompoundingFrequency, StakingProjectionResult } from "@tokelio-labs/sdk";
import { findStakingPool, projectStakingRewards, STAKING_POOLS } from "@tokelio-labs/sdk";
import { toCleanError } from "../errors.js";

export interface StakeProjectOptions {
  principal: number;
  apr?: number | undefined;
  pool?: string | undefined;
  durationDays: number;
  compounding?: CompoundingFrequency | undefined;
}

export interface StakeProjectResult extends StakingProjectionResult {
  /** The pool name the APR was resolved from, if any. */
  pool: string | null;
}

/**
 * Projects the yield on a staked TOKE position using the SDK's deterministic
 * `projectStakingRewards` model — the same economics as the Tokelio dApp's
 * Staking view. Read-only: it stakes nothing and touches no ledger or wallet.
 *
 * Either `apr` or a known `pool` name must be provided; an explicit `apr`
 * overrides the pool's APR. APRs are illustrative preview projections, not
 * guaranteed yields.
 */
export function stakeProject(opts: StakeProjectOptions): StakeProjectResult {
  try {
    let apr = opts.apr;
    let poolName: string | null = null;

    if (opts.pool !== undefined) {
      const pool = findStakingPool(opts.pool);
      if (!pool) {
        const names = STAKING_POOLS.map((p) => `"${p.name}"`).join(", ");
        throw new Error(`Unknown staking pool "${opts.pool}". Available pools: ${names}.`);
      }
      poolName = pool.name;
      if (apr === undefined) {
        apr = pool.apr;
      }
    }

    if (apr === undefined) {
      throw new Error('Provide either --apr or a known --pool to project staking rewards.');
    }

    const projection = projectStakingRewards({
      principal: opts.principal,
      apr,
      durationDays: opts.durationDays,
      ...(opts.compounding !== undefined ? { compounding: opts.compounding } : {}),
    });

    return { ...projection, pool: poolName };
  } catch (err) {
    throw toCleanError(err);
  }
}
