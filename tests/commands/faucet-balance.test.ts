import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { faucet } from "../../src/commands/faucet.js";
import { balance } from "../../src/commands/balance.js";

describe("faucet + balance", () => {
  beforeEach(async () => {
    await setupTokelioHome();
  });

  afterEach(async () => {
    await teardownTokelioHome();
  });

  it("faucet then balance round-trip shows the funded amount formatted correctly", async () => {
    const funded = await faucet({ agentId: "agent-a", amount: "50" });
    expect(funded.balance).toBe("50");

    const result = await balance({ agentId: "agent-a" });
    expect(result.agentId).toBe("agent-a");
    expect(result.balance).toBe("50");
  });

  it("accumulates across multiple faucet calls, including fractional amounts", async () => {
    await faucet({ agentId: "agent-a", amount: "10.5" });
    await faucet({ agentId: "agent-a", amount: "4.25" });

    const result = await balance({ agentId: "agent-a" });
    expect(result.balance).toBe("14.75");
  });

  it("an unfunded agent has a zero balance", async () => {
    const result = await balance({ agentId: "never-funded" });
    expect(result.balance).toBe("0");
  });
});
