import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { faucet } from "../../src/commands/faucet.js";
import { pay } from "../../src/commands/pay.js";
import { historyShow } from "../../src/commands/history.js";

describe("history", () => {
  let outDir: string;

  beforeEach(async () => {
    await setupTokelioHome();
    outDir = await mkdtemp(path.join(tmpdir(), "tokelio-cli-history-out-"));
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
    await teardownTokelioHome();
  });

  it("defaults to JSON format and reflects transfer history", async () => {
    await faucet({ agentId: "agent-a", amount: "100" });
    await pay({ from: "agent-a", to: "agent-b", amount: "30", memo: "invoice #1" });

    const result = await historyShow({ agentId: "agent-a" });
    expect(result.format).toBe("json");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.to).toBe("agent-b");

    const parsed = JSON.parse(result.formatted) as Array<{ to: string; amount: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.amount).toBe("30");
  });

  it("supports CSV format", async () => {
    await faucet({ agentId: "agent-a", amount: "100" });
    await pay({ from: "agent-a", to: "agent-b", amount: "30", memo: "invoice, with a comma" });

    const result = await historyShow({ agentId: "agent-a", format: "csv" });
    expect(result.format).toBe("csv");
    const lines = result.formatted.split("\n");
    expect(lines[0]).toBe("id,from,to,amount,memo,timestamp");
    expect(lines[1]).toContain('"invoice, with a comma"');
  });

  it("writes to --output file when given, in addition to returning the string", async () => {
    await faucet({ agentId: "agent-a", amount: "100" });
    await pay({ from: "agent-a", to: "agent-b", amount: "10" });

    const outputPath = path.join(outDir, "history.json");
    const result = await historyShow({ agentId: "agent-a", output: outputPath });
    expect(result.outputPath).toBe(outputPath);

    const written = await readFile(outputPath, "utf8");
    expect(written).toBe(result.formatted);
  });

  it("rejects an invalid format", async () => {
    await expect(historyShow({ agentId: "agent-a", format: "xml" as never })).rejects.toThrow(
      /invalid history format/i,
    );
  });

  it("an agent with no history returns an empty export", async () => {
    const result = await historyShow({ agentId: "never-paid" });
    expect(result.records).toEqual([]);
    expect(JSON.parse(result.formatted)).toEqual([]);
  });
});
