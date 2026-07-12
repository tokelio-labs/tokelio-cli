import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "./test-helpers.js";
import { buildProgram } from "../src/cli.js";
import { faucet } from "../src/commands/faucet.js";

describe("--json output flag", () => {
  beforeEach(async () => {
    await setupTokelioHome();
  });

  afterEach(async () => {
    await teardownTokelioHome();
  });

  it("balance --json prints a single line of valid, parseable JSON", async () => {
    await faucet({ agentId: "agent-a", amount: "42" });

    const logs: unknown[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(msg);
    });

    try {
      await buildProgram().parseAsync(["node", "tokelio", "--json", "balance", "agent-a"]);
    } finally {
      logSpy.mockRestore();
    }

    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(String(logs[0])) as { agentId: string; balance: string };
    expect(parsed).toEqual({ agentId: "agent-a", balance: "42" });
  });

  it("without --json, balance prints human-readable chalk output, not JSON", async () => {
    await faucet({ agentId: "agent-a", amount: "42" });

    const logs: unknown[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(msg);
    });

    try {
      await buildProgram().parseAsync(["node", "tokelio", "balance", "agent-a"]);
    } finally {
      logSpy.mockRestore();
    }

    expect(logs).toHaveLength(1);
    expect(String(logs[0])).toContain("agent-a balance: 42 TOKE");
    expect(() => {
      JSON.parse(String(logs[0]));
    }).toThrow();
  });

  it("an error in --json mode prints {\"error\": ...} instead of a red Error: line", async () => {
    const logs: unknown[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(msg);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await buildProgram().parseAsync(["node", "tokelio", "--json", "pay", "--from", "agent-a", "--to", "agent-b", "--amount", "5"]);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }

    expect(process.exitCode).toBe(1);
    process.exitCode = 0;

    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(String(logs[0])) as { error: string };
    expect(parsed.error).toMatch(/insufficient balance/i);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
