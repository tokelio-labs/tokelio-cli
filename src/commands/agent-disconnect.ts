import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AgentDisconnectTarget = "claude-code";

export interface AgentDisconnectOptions {
  target?: AgentDisconnectTarget;
  /** Override for `process.cwd()` — used by tests; the CLI wiring never sets this. */
  cwd?: string;
}

export interface AgentDisconnectResult {
  target: AgentDisconnectTarget;
  configPath: string;
  /** True if a `tokelio` entry was found and removed. */
  removed: boolean;
  /** Set (and `removed` is false) when there was nothing to remove. */
  reason?: string;
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown> | undefined> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if (isEnoent(err)) {
      return undefined;
    }
    throw err;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(
      `Existing config at ${filePath} is not valid JSON — refusing to modify it. Fix or remove the file and try again.`,
    );
  }
}

/**
 * Companion to `agent connect`: removes just the `tokelio` MCP server entry
 * from `./.mcp.json` in `process.cwd()`, preserving any other entries. If
 * the file doesn't exist, or exists but has no `tokelio` entry, that's
 * reported clearly via `removed: false` / `reason` rather than throwing.
 */
export async function agentDisconnect(
  opts: AgentDisconnectOptions = {},
): Promise<AgentDisconnectResult> {
  const target: AgentDisconnectTarget = opts.target ?? "claude-code";
  const cwd = opts.cwd ?? process.cwd();
  const configPath = path.join(cwd, ".mcp.json");

  const existing = await readJsonIfExists(configPath);
  if (existing === undefined) {
    return { target, configPath, removed: false, reason: `No ${configPath} file found.` };
  }

  const servers = existing["mcpServers"] as Record<string, unknown> | undefined;
  if (!servers || !("tokelio" in servers)) {
    return { target, configPath, removed: false, reason: `No "tokelio" entry found in ${configPath}.` };
  }

  const { tokelio: _tokelio, ...remainingServers } = servers;
  const updated = { ...existing, mcpServers: remainingServers };
  await writeFile(configPath, JSON.stringify(updated, null, 2) + "\n", "utf8");

  return { target, configPath, removed: true };
}
