import {
  AgentNotFoundError,
  BudgetExceededError,
  EscrowAlreadyResolvedError,
  EscrowNotFoundError,
  InsufficientBalanceError,
  InvalidAmountError,
  PolicyViolationError,
  TokelioError,
  formatAmount,
} from "@tokelio/sdk";

/**
 * Maps SDK errors (and anything else a command might throw) into a plain
 * `Error` with a clean, human-readable message suitable for printing
 * directly to the terminal — never a stack trace or `[object Object]`.
 */
export function toCleanError(err: unknown): Error {
  if (err instanceof InsufficientBalanceError) {
    return new Error(
      `Insufficient balance: agent has ${formatAmount(err.available)} TOKE, payment requires ${formatAmount(err.required)} TOKE`,
    );
  }

  if (err instanceof BudgetExceededError) {
    return new Error(
      `Budget exceeded: requested ${formatAmount(err.requested)} TOKE, only ${formatAmount(err.remaining)} TOKE remaining in the current budget period`,
    );
  }

  if (err instanceof EscrowNotFoundError) {
    return new Error(`Escrow task not found: ${err.taskId}`);
  }

  if (err instanceof EscrowAlreadyResolvedError) {
    return new Error(`Escrow task ${err.taskId} is already resolved (status: ${err.status})`);
  }

  if (err instanceof InvalidAmountError) {
    return new Error(err.message);
  }

  if (err instanceof PolicyViolationError) {
    return new Error(`Policy violation (${err.policyName}): ${err.reason}`);
  }

  if (err instanceof AgentNotFoundError) {
    return new Error(`Agent not found: ${err.address}`);
  }

  if (err instanceof TokelioError) {
    return new Error(err.message);
  }

  if (err instanceof Error) {
    return err;
  }

  return new Error(String(err));
}
