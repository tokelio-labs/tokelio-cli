import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getLedgerPath } from "../config.js";
import { addWallet, loadWallets } from "../wallets.js";

export type AgentConnectTarget = "claude-code" | "claude-desktop";

/** The MCP server config fragment that wires the CLI's local wallet/ledger into an MCP client. */
export interface McpServerFragment {
  command: string;
  args: string[];
  env: {
    TOKELIO_LEDGER_PATH: string;
    TOKELIO_AGENT_ID: string;
  };
}

export interface AgentConnectOptions {
  agentId?: string;
  target?: AgentConnectTarget;
  write?: boolean;
  /** Override for `process.cwd()` — used by tests; the CLI wiring never sets this. */
  cwd?: string;
}

export interface AgentConnectResult {
  agentId: string;
  target: AgentConnectTarget;
  fragment: McpServerFragment;
  /** Path actually written to, if a file was written. */
  configPath?: string;
  /** True when nothing was written and the fragment was only meant to be printed/pasted. */
  printedOnly?: boolean;
  /** The full `{ mcpServers: { tokelio: fragment } }` document — provided for the printedOnly case. */
  fullConfig?: { mcpServers: Record<string, McpServerFragment> };
  /** Reference (non-authoritative, informational) config paths per OS, for the printedOnly case. */
  referencePaths?: { macos: string; linux: string; windows: string };
  nextSteps: string[];
}

const REFERENCE_PATHS = {
  macos: "~/Library/Application Support/Claude/claude_desktop_config.json",
  linux: "~/.config/Claude/claude_desktop_config.json",
  windows: "%APPDATA%\\Claude\\claude_desktop_config.json",
};

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if (isEnoent(err)) {
      return {};
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
      `Existing config at ${filePath} is not valid JSON — refusing to overwrite it. Fix or remove the file and try again.`,
    );
  }
}

async function mergeAndWriteMcpConfig(filePath: string, fragment: McpServerFragment): Promise<void> {
  const existing = await readJsonIfExists(filePath);
  const existingServers = (existing["mcpServers"] as Record<string, unknown> | undefined) ?? {};
  const merged = {
    ...existing,
    mcpServers: {
      ...existingServers,
      tokelio: fragment,
    },
  };

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(merged, null, 2) + "\n", "utf8");
}

function claudeDesktopConfigPath(): string {
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "win32": {
      const appData = process.env["APPDATA"] ?? path.join(home, "AppData", "Roaming");
      return path.join(appData, "Claude", "claude_desktop_config.json");
    }
    default:
      return path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

function buildFragment(agentId: string): McpServerFragment {
  return {
    command: "npx",
    args: ["-y", "@tokelio-labs/mcp-server"],
    env: {
      TOKELIO_LEDGER_PATH: getLedgerPath(),
      TOKELIO_AGENT_ID: agentId,
    },
  };
}

function buildNextSteps(agentId: string, target: AgentConnectTarget): string[] {
  return [
    target === "claude-code"
      ? "Restart Claude Code (or reload its MCP servers) in this project so it picks up the new .mcp.json entry."
      : "Restart Claude Desktop so it picks up the updated config.",
    `Then try asking it: "What's the Tokelio balance for agent ${agentId}?" — it should be able to call the tokelio MCP server using the wallet/ledger you've been managing with this CLI.`,
  ];
}

/**
 * Resolves which agent id to wire up:
 * - if `agentId` is given explicitly, use it — creating the wallet locally
 *   first if it doesn't exist yet, so `agent connect` works standalone
 *   without requiring a prior `wallet create`.
 * - otherwise, auto-select if there's exactly one known wallet, or throw a
 *   clear, actionable error if there are zero or more than one.
 */
async function resolveAgentId(agentId: string | undefined): Promise<string> {
  if (agentId) {
    const wallets = await loadWallets();
    if (!wallets.some((w) => w.agentId === agentId)) {
      await addWallet(agentId);
    }
    return agentId;
  }

  const wallets = await loadWallets();
  if (wallets.length === 0) {
    throw new Error(
      'No wallets found. Run "tokelio wallet create <agentId>" first, or pass --agent-id <agentId> to "tokelio agent connect".',
    );
  }
  if (wallets.length > 1) {
    const ids = wallets.map((w) => w.agentId).join(", ");
    throw new Error(
      `Multiple wallets found (${ids}). Disambiguate with --agent-id <agentId>.`,
    );
  }

  const [only] = wallets;
  // wallets.length === 1 was just checked, so this is always defined.
  return (only as (typeof wallets)[number]).agentId;
}

/**
 * Wires a Tokelio agent identity into an MCP-capable client so it can
 * transact using the same local wallet/ledger state managed by this CLI.
 */
export async function agentConnect(opts: AgentConnectOptions = {}): Promise<AgentConnectResult> {
  const target: AgentConnectTarget = opts.target ?? "claude-code";
  const agentId = await resolveAgentId(opts.agentId);
  const fragment = buildFragment(agentId);
  const nextSteps = buildNextSteps(agentId, target);

  if (target === "claude-code") {
    const cwd = opts.cwd ?? process.cwd();
    const configPath = path.join(cwd, ".mcp.json");
    await mergeAndWriteMcpConfig(configPath, fragment);
    return { agentId, target, fragment, configPath, nextSteps };
  }

  // target === "claude-desktop"
  const fullConfig = { mcpServers: { tokelio: fragment } };

  if (!opts.write) {
    return {
      agentId,
      target,
      fragment,
      printedOnly: true,
      fullConfig,
      referencePaths: REFERENCE_PATHS,
      nextSteps,
    };
  }

  const configPath = claudeDesktopConfigPath();
  const dir = path.dirname(configPath);
  try {
    await stat(dir);
  } catch (err) {
    if (isEnoent(err)) {
      throw new Error(
        `Claude Desktop config directory does not exist: ${dir}. Make sure Claude Desktop is installed (or create the directory manually), then retry with --write.`,
      );
    }
    throw err;
  }

  await mergeAndWriteMcpConfig(configPath, fragment);
  return { agentId, target, fragment, configPath, nextSteps };
}
