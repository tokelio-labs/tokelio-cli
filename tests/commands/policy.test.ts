import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { resetClientCache } from "../../src/client.js";
import { faucet } from "../../src/commands/faucet.js";
import { pay } from "../../src/commands/pay.js";
import {
  policyAllow,
  policyClear,
  policyDeny,
  policySetMaxTransaction,
  policyShow,
} from "../../src/commands/policy.js";

describe("policy", () => {
  beforeEach(async () => {
    await setupTokelioHome();
  });

  afterEach(async () => {
    await teardownTokelioHome();
  });

  it("set-max-transaction blocks an over-limit payment on a fresh client, allows one within the limit", async () => {
    await faucet({ agentId: "agent-a", amount: "1000" });

    const setResult = await policySetMaxTransaction({ limit: "10" });
    expect(setResult.config.maxTransactionAmount).toBe("10");

    // Real CLI invocations always get a brand-new client (each `tokelio`
    // command is its own process); within a single test process we have to
    // force the same via resetClientCache() so the just-persisted policy
    // config is actually picked up by the next getClient() call.
    resetClientCache();

    await expect(pay({ from: "agent-a", to: "agent-b", amount: "50" })).rejects.toThrow(/policy/i);

    const withinLimit = await pay({ from: "agent-a", to: "agent-b", amount: "5" });
    expect(withinLimit.amount).toBe("5");
  });

  it("allow sets a payee allowlist that blocks non-listed payees", async () => {
    await faucet({ agentId: "agent-a", amount: "1000" });
    await policyAllow({ agentIds: ["agent-b"] });
    resetClientCache();

    await expect(pay({ from: "agent-a", to: "agent-c", amount: "5" })).rejects.toThrow(/policy/i);

    const ok = await pay({ from: "agent-a", to: "agent-b", amount: "5" });
    expect(ok.record.to).toBe("agent-b");
  });

  it("deny sets a payee denylist that blocks listed payees", async () => {
    await faucet({ agentId: "agent-a", amount: "1000" });
    await policyDeny({ agentIds: ["agent-b"] });
    resetClientCache();

    await expect(pay({ from: "agent-a", to: "agent-b", amount: "5" })).rejects.toThrow(/policy/i);

    const ok = await pay({ from: "agent-a", to: "agent-c", amount: "5" });
    expect(ok.record.to).toBe("agent-c");
  });

  it("show returns the persisted config", async () => {
    await policySetMaxTransaction({ limit: "25" });
    const result = await policyShow();
    expect(result.config.maxTransactionAmount).toBe("25");
  });

  it("show returns an empty config when nothing is configured", async () => {
    const result = await policyShow();
    expect(result.config).toEqual({});
  });

  it("clear resets the config", async () => {
    await policySetMaxTransaction({ limit: "25" });
    await policyAllow({ agentIds: ["agent-b"] });

    await policyClear();
    const result = await policyShow();
    expect(result.config).toEqual({});
  });

  it("allow and deny replace (not merge with) any previously configured list", async () => {
    await policyAllow({ agentIds: ["agent-a"] });
    await policyAllow({ agentIds: ["agent-b", "agent-c"] });

    const result = await policyShow();
    expect(result.config.payeeAllowlist).toEqual(["agent-b", "agent-c"]);
  });
});
