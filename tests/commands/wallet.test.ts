import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { walletCreate, walletList } from "../../src/commands/wallet.js";

describe("wallet commands", () => {
  beforeEach(async () => {
    await setupTokelioHome();
  });

  afterEach(async () => {
    await teardownTokelioHome();
  });

  it("creates a wallet", async () => {
    const result = await walletCreate({ agentId: "agent-a", name: "Agent A" });
    expect(result.wallet.agentId).toBe("agent-a");
    expect(result.wallet.name).toBe("Agent A");
    expect(typeof result.wallet.createdAt).toBe("number");
  });

  it("creates a wallet without a name", async () => {
    const result = await walletCreate({ agentId: "agent-a" });
    expect(result.wallet.agentId).toBe("agent-a");
    expect(result.wallet.name).toBeUndefined();
  });

  it("throws on duplicate agentId", async () => {
    await walletCreate({ agentId: "agent-a" });
    await expect(walletCreate({ agentId: "agent-a" })).rejects.toThrow(/already exists/i);
  });

  it("list reflects created wallets in order", async () => {
    await walletCreate({ agentId: "agent-a" });
    await walletCreate({ agentId: "agent-b" });
    await walletCreate({ agentId: "agent-c" });

    const { wallets } = await walletList();
    expect(wallets.map((w) => w.agentId)).toEqual(["agent-a", "agent-b", "agent-c"]);
  });

  it("list is empty when no wallets exist", async () => {
    const { wallets } = await walletList();
    expect(wallets).toEqual([]);
  });
});
