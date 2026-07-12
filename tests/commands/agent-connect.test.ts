import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { agentConnect } from "../../src/commands/agent-connect.js";
import { walletCreate } from "../../src/commands/wallet.js";
import { getLedgerPath } from "../../src/config.js";

describe("agent connect", () => {
  let cwd: string;
  let originalCwd: string;

  beforeEach(async () => {
    await setupTokelioHome();
    originalCwd = process.cwd();
    cwd = await mkdtemp(path.join(tmpdir(), "tokelio-cli-cwd-"));
    process.chdir(cwd);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(cwd, { recursive: true, force: true });
    await teardownTokelioHome();
  });

  it("claude-code target creates a valid .mcp.json with the agent id and ledger path", async () => {
    await walletCreate({ agentId: "agent-a" });

    const result = await agentConnect({ agentId: "agent-a", target: "claude-code" });

    expect(result.configPath).toBe(path.join(cwd, ".mcp.json"));
    expect(result.printedOnly).toBeUndefined();

    const raw = await readFile(result.configPath as string, "utf8");
    const parsed = JSON.parse(raw) as {
      mcpServers: { tokelio: { command: string; args: string[]; env: Record<string, string> } };
    };

    expect(parsed.mcpServers.tokelio.command).toBe("npx");
    expect(parsed.mcpServers.tokelio.args).toEqual(["-y", "@tokelio/mcp-server"]);
    expect(parsed.mcpServers.tokelio.env["TOKELIO_AGENT_ID"]).toBe("agent-a");
    expect(parsed.mcpServers.tokelio.env["TOKELIO_LEDGER_PATH"]).toBe(getLedgerPath());
  });

  it("merges into a pre-existing .mcp.json, preserving unrelated server entries", async () => {
    await writeFile(
      path.join(cwd, ".mcp.json"),
      JSON.stringify({ mcpServers: { other: { command: "foo", args: ["bar"] } } }, null, 2),
      "utf8",
    );
    await walletCreate({ agentId: "agent-a" });

    await agentConnect({ agentId: "agent-a", target: "claude-code" });

    const parsed = JSON.parse(await readFile(path.join(cwd, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(parsed.mcpServers["other"]).toEqual({ command: "foo", args: ["bar"] });
    expect(parsed.mcpServers["tokelio"]).toBeDefined();
  });

  it("throws a clear error rather than clobbering a malformed existing .mcp.json", async () => {
    await writeFile(path.join(cwd, ".mcp.json"), "{ not valid json", "utf8");
    await walletCreate({ agentId: "agent-a" });

    await expect(agentConnect({ agentId: "agent-a", target: "claude-code" })).rejects.toThrow(
      /not valid json/i,
    );
  });

  it("claude-desktop without --write returns printedOnly and writes no file", async () => {
    await walletCreate({ agentId: "agent-a" });

    const result = await agentConnect({ agentId: "agent-a", target: "claude-desktop" });

    expect(result.printedOnly).toBe(true);
    expect(result.configPath).toBeUndefined();
    expect(result.fullConfig?.mcpServers["tokelio"]?.env.TOKELIO_AGENT_ID).toBe("agent-a");
    expect(result.referencePaths?.macos).toContain("Claude");

    const entries = await readdir(cwd);
    expect(entries).toEqual([]);
  });

  it("throws a clear error when zero wallets exist and no --agent-id is given", async () => {
    await expect(agentConnect({})).rejects.toThrow(/wallet create/i);
  });

  it("throws a clear disambiguation error when two wallets exist and no --agent-id is given", async () => {
    await walletCreate({ agentId: "agent-a" });
    await walletCreate({ agentId: "agent-b" });

    await expect(agentConnect({})).rejects.toThrow(/--agent-id/);
  });

  it("auto-selects the sole wallet when exactly one exists and no --agent-id is given", async () => {
    await walletCreate({ agentId: "only-agent" });

    const result = await agentConnect({});
    expect(result.agentId).toBe("only-agent");
  });

  it("passing --agent-id for a not-yet-registered agent creates its wallet", async () => {
    const result = await agentConnect({ agentId: "brand-new-agent", target: "claude-code" });
    expect(result.agentId).toBe("brand-new-agent");

    const raw = await readFile(path.join(cwd, ".mcp.json"), "utf8");
    const parsed = JSON.parse(raw) as { mcpServers: { tokelio: { env: Record<string, string> } } };
    expect(parsed.mcpServers.tokelio.env["TOKELIO_AGENT_ID"]).toBe("brand-new-agent");
  });
});
