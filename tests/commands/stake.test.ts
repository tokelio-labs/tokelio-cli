import { describe, expect, it } from "vitest";
import { stakeProject } from "../../src/commands/stake.js";

describe("stakeProject", () => {
  it("projects simple-interest rewards from an explicit APR", () => {
    const result = stakeProject({ principal: 1000, apr: 18.4, durationDays: 365 });
    expect(result.totalReward).toBe(184);
    expect(result.finalBalance).toBe(1184);
    expect(result.pool).toBeNull();
  });

  it("resolves the APR from a named pool", () => {
    const result = stakeProject({ principal: 1000, pool: "Validator Vault", durationDays: 90 });
    expect(result.pool).toBe("Validator Vault");
    expect(result.resolved.apr).toBe(31.7);
  });

  it("lets an explicit APR override the pool APR", () => {
    const result = stakeProject({ principal: 1000, pool: "Operator Vault", apr: 50, durationDays: 365 });
    expect(result.resolved.apr).toBe(50);
    expect(result.pool).toBe("Operator Vault");
  });

  it("compounds daily to a higher total than simple interest", () => {
    const simple = stakeProject({ principal: 1000, apr: 18.4, durationDays: 365 });
    const daily = stakeProject({ principal: 1000, apr: 18.4, durationDays: 365, compounding: "daily" });
    expect(daily.totalReward).toBeGreaterThan(simple.totalReward);
  });

  it("throws on an unknown pool name", () => {
    expect(() => stakeProject({ principal: 1000, pool: "Nope Vault", durationDays: 30 })).toThrow(
      /Unknown staking pool/,
    );
  });

  it("throws when neither apr nor pool is provided", () => {
    expect(() => stakeProject({ principal: 1000, durationDays: 30 })).toThrow(
      /Provide either --apr or a known --pool/,
    );
  });
});
