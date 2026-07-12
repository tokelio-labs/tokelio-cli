import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { getWalletsPath } from "./config.js";

/** A single wallet the CLI knows about (an agent id it has created/tracked locally). */
export interface WalletEntry {
  agentId: string;
  name?: string;
  createdAt: number;
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

/** Loads all known wallets. Returns an empty array if `wallets.json` doesn't exist yet. */
export async function loadWallets(): Promise<WalletEntry[]> {
  const filePath = getWalletsPath();
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if (isEnoent(err)) {
      return [];
    }
    throw err;
  }

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed as WalletEntry[];
}

/** Overwrites `wallets.json` with the given list of wallets. */
export async function saveWallets(wallets: WalletEntry[]): Promise<void> {
  const filePath = getWalletsPath();
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(wallets, null, 2) + "\n", "utf8");
}

/**
 * Registers a new wallet locally.
 * @throws {Error} if `agentId` is already registered.
 */
export async function addWallet(agentId: string, name?: string): Promise<WalletEntry> {
  const wallets = await loadWallets();
  if (wallets.some((w) => w.agentId === agentId)) {
    throw new Error(`Wallet already exists for agent id "${agentId}"`);
  }

  const entry: WalletEntry = {
    agentId,
    ...(name !== undefined ? { name } : {}),
    createdAt: Date.now(),
  };
  wallets.push(entry);
  await saveWallets(wallets);
  return entry;
}
