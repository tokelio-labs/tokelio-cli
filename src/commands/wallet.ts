import type { WalletEntry } from "../wallets.js";
import { addWallet, loadWallets } from "../wallets.js";

export interface WalletCreateOptions {
  agentId: string;
  name?: string;
}

export interface WalletCreateResult {
  wallet: WalletEntry;
}

/** Registers a new local wallet for `agentId`. Throws if it already exists. */
export async function walletCreate(opts: WalletCreateOptions): Promise<WalletCreateResult> {
  const wallet = await addWallet(opts.agentId, opts.name);
  return { wallet };
}

export interface WalletListResult {
  wallets: WalletEntry[];
}

/** Lists all locally registered wallets, in the order they were created. */
export async function walletList(): Promise<WalletListResult> {
  const wallets = await loadWallets();
  return { wallets };
}
