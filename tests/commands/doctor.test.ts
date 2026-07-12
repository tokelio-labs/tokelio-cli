import { writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { doctor } from "../../src/commands/doctor.js";
import { getWalletsPath } from "../../src/config.js";

describe("doctor", () => {
  beforeEach(async () => {
    await setupTokelioHome();
  });

  afterEach(async () => {
    await teardownTokelioHome();
  });

  it("reports all-ok checks for a freshly initialized home dir", async () => {
    const result = await doctor();

    expect(result.checks.length).toBeGreaterThan(0);
    for (const check of result.checks) {
      expect(check.status).toBe("ok");
    }

    const names = result.checks.map((c) => c.name);
    expect(names).toContain("TOKELIO_HOME");
    expect(names).toContain("wallets.json");
    expect(names).toContain("budgets.json");
    expect(names).toContain("policies.json");
    expect(names).toContain("ledger.json");
    expect(names).toContain("node version");
  });

  it("reports a corrupted JSON file as an error rather than throwing", async () => {
    await writeFile(getWalletsPath(), "{ not valid json", "utf8");

    const result = await doctor();

    const walletsCheck = result.checks.find((c) => c.name === "wallets.json");
    expect(walletsCheck?.status).toBe("error");
    expect(walletsCheck?.detail).toMatch(/not valid json/i);

    const otherChecks = result.checks.filter((c) => c.name !== "wallets.json");
    expect(otherChecks.every((c) => c.status !== "error")).toBe(true);
  });
});
