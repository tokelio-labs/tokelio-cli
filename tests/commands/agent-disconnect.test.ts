import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupTokelioHome, teardownTokelioHome } from "../test-helpers.js";
import { agentConnect } from "../../src/commands/agent-connect.js";
import { agentDisconnect } from "../../src/commands/agent-disconnect.js";
import { walletCreate } from "../../src/commands/wallet.js";

describe("agent disconnect", () => {
  let cwd: string;
  let originalCwd: string;

  beforeEach(async () => {
    await setupTokelioHome();
    originalCwd = process.cwd();
    cwd = await mkdtemp(path.join(tmpdir(), "tokelio-cli-disconnect-"));
    process.chdir(cwd);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(cwd, { recursive: true, force: true });
    await teardownTokelioHome();
  });

  it("removes only the tokelio entry, preserving other entries", async () => {
    await writeFile(
      path.join(cwd, ".mcp.json"),
      JSON.stringify({ mcpServers: { other: { command: "foo", args: ["bar"] } } }, null, 2),
      "utf8",
    );
    await walletCreate({ agentId: "agent-a" });
    await agentConnect({ agentId: "agent-a", target: "claude-code" });

    const result = await agentDisconnect({});
    expect(result.removed).toBe(true);

    const parsed = JSON.parse(await readFile(path.join(cwd, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(parsed.mcpServers["tokelio"]).toBeUndefined();
    expect(parsed.mcpServers["other"]).toEqual({ command: "foo", args: ["bar"] });
  });

  it("reports clearly when no .mcp.json file exists, rather than throwing", async () => {
    const result = await agentDisconnect({});
    expect(result.removed).toBe(false);
    expect(result.reason).toMatch(/no .*\.mcp\.json/i);
  });

  it("reports clearly when .mcp.json exists but has no tokelio entry", async () => {
    await writeFile(
      path.join(cwd, ".mcp.json"),
      JSON.stringify({ mcpServers: { other: { command: "foo", args: [] } } }, null, 2),
      "utf8",
    );

    const result = await agentDisconnect({});
    expect(result.removed).toBe(false);
    expect(result.reason).toMatch(/no "tokelio" entry/i);

    // Untouched — the file wasn't rewritten.
    const parsed = JSON.parse(await readFile(path.join(cwd, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(parsed.mcpServers["other"]).toEqual({ command: "foo", args: [] });
  });

  it("throws a clear error rather than clobbering a malformed existing .mcp.json", async () => {
    await writeFile(path.join(cwd, ".mcp.json"), "{ not valid json", "utf8");

    await expect(agentDisconnect({})).rejects.toThrow(/not valid json/i);
  });
});
