import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { faucet } from "../../src/commands/faucet.js";
import { balance } from "../../src/commands/balance.js";
import { pay } from "../../src/commands/pay.js";
import { budgetSet } from "../../src/commands/budget.js";

describe("pay", () => {
  beforeEach(async () => {
    await setupTokelioHome();
  });

  afterEach(async () => {
    await teardownTokelioHome();
  });

  it("moves funds and returns a transfer record", async () => {
    await faucet({ agentId: "agent-a", amount: "100" });

    const result = await pay({ from: "agent-a", to: "agent-b", amount: "30", memo: "invoice #1" });
    expect(result.amount).toBe("30");
    expect(result.record.from).toBe("agent-a");
    expect(result.record.to).toBe("agent-b");
    expect(result.record.memo).toBe("invoice #1");
    expect(typeof result.record.id).toBe("string");

    const senderBalance = await balance({ agentId: "agent-a" });
    const receiverBalance = await balance({ agentId: "agent-b" });
    expect(senderBalance.balance).toBe("70");
    expect(receiverBalance.balance).toBe("30");
  });

  it("throws a clean mapped error on insufficient balance", async () => {
    await faucet({ agentId: "agent-a", amount: "5" });

    await expect(pay({ from: "agent-a", to: "agent-b", amount: "10" })).rejects.toThrow(
      /insufficient balance/i,
    );
  });

  it("throws a clean mapped error when a payment exceeds a configured budget", async () => {
    await faucet({ agentId: "agent-a", amount: "1000" });
    await budgetSet({ agentId: "agent-a", limit: "20", period: "daily" });

    await expect(pay({ from: "agent-a", to: "agent-b", amount: "50" })).rejects.toThrow(
      /budget exceeded/i,
    );

    // The rejected payment must not have moved any funds.
    const senderBalance = await balance({ agentId: "agent-a" });
    expect(senderBalance.balance).toBe("1000");
  });

  it("allows a payment within the configured budget", async () => {
    await faucet({ agentId: "agent-a", amount: "1000" });
    await budgetSet({ agentId: "agent-a", limit: "20", period: "daily" });

    const result = await pay({ from: "agent-a", to: "agent-b", amount: "15" });
    expect(result.amount).toBe("15");
  });
});
