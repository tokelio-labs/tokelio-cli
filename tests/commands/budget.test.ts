import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { budgetSet, budgetShow } from "../../src/commands/budget.js";

describe("budget", () => {
  beforeEach(async () => {
    await setupTokelioHome();
  });

  afterEach(async () => {
    await teardownTokelioHome();
  });

  it("set then show reflects the configured limit, period, and remaining amount", async () => {
    const setResult = await budgetSet({ agentId: "agent-a", limit: "100", period: "daily" });
    expect(setResult).toEqual({ agentId: "agent-a", limit: "100", period: "daily" });

    const showResult = await budgetShow({ agentId: "agent-a" });
    expect(showResult.limit).toBe("100");
    expect(showResult.period).toBe("daily");
    expect(showResult.remaining).toBe("100");
  });

  it("show returns nulls for an agent with no configured budget", async () => {
    const result = await budgetShow({ agentId: "no-budget-agent" });
    expect(result.limit).toBeNull();
    expect(result.period).toBeNull();
    expect(result.remaining).toBeNull();
  });

  it("rejects an invalid budget period", async () => {
    await expect(
      budgetSet({ agentId: "agent-a", limit: "10", period: "monthly" as never }),
    ).rejects.toThrow(/invalid budget period/i);
  });

  it("supports session, hourly, and weekly periods", async () => {
    await budgetSet({ agentId: "session-agent", limit: "1", period: "session" });
    await budgetSet({ agentId: "hourly-agent", limit: "2", period: "hourly" });
    await budgetSet({ agentId: "weekly-agent", limit: "3", period: "weekly" });

    expect((await budgetShow({ agentId: "session-agent" })).period).toBe("session");
    expect((await budgetShow({ agentId: "hourly-agent" })).period).toBe("hourly");
    expect((await budgetShow({ agentId: "weekly-agent" })).period).toBe("weekly");
  });
});
