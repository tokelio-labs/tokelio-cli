import { describe, expect, it } from "vitest";
import { simulate } from "../../src/commands/simulate.js";

describe("simulate", () => {
  it("forecasts default-cost tasks a budget affords", () => {
    const result = simulate({ budget: 1000 });
    expect(result.tasksCompleted).toBe(18); // floor(1000 / 55.08)
    expect(result.budgetExhausted).toBe(false);
    expect(result.resolved.budget).toBe(1000);
  });

  it("returns the full per-task steps ledger for --json consumers", () => {
    const result = simulate({ budget: 300, tasks: 3 });
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]?.index).toBe(1);
  });

  it("flags exhaustion when the budget can't cover the requested tasks", () => {
    const result = simulate({ budget: 60, tasks: 10 });
    expect(result.tasksCompleted).toBe(1);
    expect(result.budgetExhausted).toBe(true);
  });

  it("honors custom per-task economics", () => {
    const result = simulate({ budget: 1000, tasks: 2, computePerTask: 100, dataPerTask: 50, feeRate: 0.1 });
    expect(result.breakdown.compute).toBe(200);
    expect(result.breakdown.data).toBe(100);
    expect(result.breakdown.fees).toBeCloseTo(30, 5);
    expect(result.totalSpent).toBeCloseTo(330, 5);
  });

  it("is deterministic for identical inputs", () => {
    expect(simulate({ budget: 777, tasks: 5 })).toEqual(simulate({ budget: 777, tasks: 5 }));
  });
});
