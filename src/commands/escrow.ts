import type { EscrowTask } from "@tokelio-labs/sdk";
import { getClient } from "../client.js";
import { toCleanError } from "../errors.js";

export interface EscrowCreateOptions {
  from: string;
  to: string;
  amount: string | number;
  description: string;
}

export interface EscrowTaskResult {
  task: EscrowTask;
}

/** Creates an escrow task, locking `amount` out of `from`'s balance until released or refunded. */
export async function escrowCreate(opts: EscrowCreateOptions): Promise<EscrowTaskResult> {
  try {
    const client = await getClient();
    const task = await client.escrow().createTask(opts.from, opts.to, opts.amount, opts.description);
    return { task };
  } catch (err) {
    throw toCleanError(err);
  }
}

export interface EscrowTaskIdOptions {
  taskId: string;
}

/** Releases a pending escrow task's locked funds to its payee. */
export async function escrowRelease(opts: EscrowTaskIdOptions): Promise<EscrowTaskResult> {
  try {
    const client = await getClient();
    const task = await client.escrow().release(opts.taskId);
    return { task };
  } catch (err) {
    throw toCleanError(err);
  }
}

/** Refunds a pending escrow task's locked funds back to its payer. */
export async function escrowRefund(opts: EscrowTaskIdOptions): Promise<EscrowTaskResult> {
  try {
    const client = await getClient();
    const task = await client.escrow().refund(opts.taskId);
    return { task };
  } catch (err) {
    throw toCleanError(err);
  }
}

/** Returns the current state of an escrow task. */
export async function escrowStatus(opts: EscrowTaskIdOptions): Promise<EscrowTaskResult> {
  try {
    const client = await getClient();
    const task = await client.escrow().getStatus(opts.taskId);
    return { task };
  } catch (err) {
    throw toCleanError(err);
  }
}
