import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { faucet } from "../../src/commands/faucet.js";
import { balance } from "../../src/commands/balance.js";
import { batchPay } from "../../src/commands/batch-pay.js";

describe("batch-pay", () => {
  let dir: string;

  beforeEach(async () => {
    await setupTokelioHome();
    dir = await mkdtemp(path.join(tmpdir(), "tokelio-cli-batch-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    await teardownTokelioHome();
  });

  it("pays every item from a JSON file", async () => {
    await faucet({ agentId: "agent-a", amount: "1000" });

    const filePath = path.join(dir, "batch.json");
    await writeFile(
      filePath,
      JSON.stringify([
        { to: "agent-b", amount: "10", memo: "first" },
        { to: "agent-c", amount: "20" },
      ]),
      "utf8",
    );

    const result = await batchPay({ from: "agent-a", file: filePath });
    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(0);

    expect((await balance({ agentId: "agent-b" })).balance).toBe("10");
    expect((await balance({ agentId: "agent-c" })).balance).toBe("20");
  });

  it("pays every item from a CSV file, round-tripping a quoted memo", async () => {
    await faucet({ agentId: "agent-a", amount: "1000" });

    const filePath = path.join(dir, "batch.csv");
    await writeFile(
      filePath,
      ["to,amount,memo", 'agent-b,15,"hello, world"', "agent-c,5,plain memo"].join("\n"),
      "utf8",
    );

    const result = await batchPay({ from: "agent-a", file: filePath });
    expect(result.succeeded).toHaveLength(2);
    expect(result.succeeded.find((r) => r.to === "agent-b")?.memo).toBe("hello, world");
    expect(result.succeeded.find((r) => r.to === "agent-c")?.memo).toBe("plain memo");
  });

  it("reports partial failures without aborting the whole batch", async () => {
    await faucet({ agentId: "agent-a", amount: "15" });

    const filePath = path.join(dir, "batch.json");
    await writeFile(
      filePath,
      JSON.stringify([
        { to: "agent-b", amount: "10" },
        { to: "agent-c", amount: "1000" },
      ]),
      "utf8",
    );

    const result = await batchPay({ from: "agent-a", file: filePath });
    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.item.to).toBe("agent-c");
    expect(result.failed[0]?.reason).toMatch(/insufficient balance/i);

    // The item after the failure never ran, and the successful item's funds moved.
    expect((await balance({ agentId: "agent-b" })).balance).toBe("10");
  });

  it("throws a clear error for a missing file", async () => {
    await expect(
      batchPay({ from: "agent-a", file: path.join(dir, "does-not-exist.json") }),
    ).rejects.toThrow(/not found/i);
  });

  it("throws a clear error for an unsupported extension", async () => {
    const filePath = path.join(dir, "batch.txt");
    await writeFile(filePath, "to,amount\nagent-b,1", "utf8");

    await expect(batchPay({ from: "agent-a", file: filePath })).rejects.toThrow(/unsupported/i);
  });

  it("throws a clear error for malformed JSON", async () => {
    const filePath = path.join(dir, "batch.json");
    await writeFile(filePath, "{ not valid json", "utf8");

    await expect(batchPay({ from: "agent-a", file: filePath })).rejects.toThrow(/not valid json/i);
  });
});
