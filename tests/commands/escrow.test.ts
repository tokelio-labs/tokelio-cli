import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { faucet } from "../../src/commands/faucet.js";
import { balance } from "../../src/commands/balance.js";
import { escrowCreate, escrowRefund, escrowRelease, escrowStatus } from "../../src/commands/escrow.js";

describe("escrow", () => {
  beforeEach(async () => {
    await setupTokelioHome();
  });

  afterEach(async () => {
    await teardownTokelioHome();
  });

  it("create locks funds out of the payer's balance", async () => {
    await faucet({ agentId: "payer", amount: "100" });

    const { task } = await escrowCreate({
      from: "payer",
      to: "payee",
      amount: "40",
      description: "research task",
    });
    expect(task.status).toBe("pending");
    expect(task.payer).toBe("payer");
    expect(task.payee).toBe("payee");
    expect(task.description).toBe("research task");

    const payerBalance = await balance({ agentId: "payer" });
    expect(payerBalance.balance).toBe("60");
  });

  it("release pays the payee and resolves the task", async () => {
    await faucet({ agentId: "payer", amount: "100" });
    const { task } = await escrowCreate({ from: "payer", to: "payee", amount: "40", description: "work" });

    const { task: released } = await escrowRelease({ taskId: task.id });
    expect(released.status).toBe("released");
    expect(released.resolvedAt).toBeDefined();

    const payeeBalance = await balance({ agentId: "payee" });
    expect(payeeBalance.balance).toBe("40");
  });

  it("refund returns funds to the payer and resolves the task", async () => {
    await faucet({ agentId: "payer", amount: "100" });
    const { task } = await escrowCreate({ from: "payer", to: "payee", amount: "40", description: "work" });

    const { task: refunded } = await escrowRefund({ taskId: task.id });
    expect(refunded.status).toBe("refunded");

    const payerBalance = await balance({ agentId: "payer" });
    expect(payerBalance.balance).toBe("100");
  });

  it("status reflects the task's current state", async () => {
    await faucet({ agentId: "payer", amount: "100" });
    const { task } = await escrowCreate({ from: "payer", to: "payee", amount: "10", description: "x" });

    const { task: pendingStatus } = await escrowStatus({ taskId: task.id });
    expect(pendingStatus.status).toBe("pending");

    await escrowRelease({ taskId: task.id });
    const { task: releasedStatus } = await escrowStatus({ taskId: task.id });
    expect(releasedStatus.status).toBe("released");
  });

  it("release-after-release throws a clean mapped error", async () => {
    await faucet({ agentId: "payer", amount: "100" });
    const { task } = await escrowCreate({ from: "payer", to: "payee", amount: "10", description: "x" });
    await escrowRelease({ taskId: task.id });

    await expect(escrowRelease({ taskId: task.id })).rejects.toThrow(/already resolved/i);
  });

  it("refund-after-release throws a clean mapped error", async () => {
    await faucet({ agentId: "payer", amount: "100" });
    const { task } = await escrowCreate({ from: "payer", to: "payee", amount: "10", description: "x" });
    await escrowRelease({ taskId: task.id });

    await expect(escrowRefund({ taskId: task.id })).rejects.toThrow(/already resolved/i);
  });

  it("status on an unknown taskId throws a clean mapped error", async () => {
    await expect(escrowStatus({ taskId: "does-not-exist" })).rejects.toThrow(/not found/i);
  });

  it("release on an unknown taskId throws a clean mapped error", async () => {
    await expect(escrowRelease({ taskId: "does-not-exist" })).rejects.toThrow(/not found/i);
  });
});
