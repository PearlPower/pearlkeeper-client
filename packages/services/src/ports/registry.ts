import type { WalletRecord } from "../contracts/index.js";

export const WALLET_REGISTRY_PORT_METHODS = [
  "listWallets",
  "getWallet",
  "getActiveWalletId",
  "addWallet",
  "removeWallet",
  "setActiveWalletId",
  "updateWalletBalance",
] as const;

export interface WalletRegistryPort {
  listWallets(): Promise<WalletRecord[]>;
  getWallet(walletId: string): Promise<WalletRecord | null>;
  getActiveWalletId(): Promise<string | null>;
  addWallet(record: WalletRecord): Promise<void>;
  removeWallet(walletId: string): Promise<void>;
  setActiveWalletId(walletId: string | null): Promise<void>;
  updateWalletBalance(walletId: string, balance: string): Promise<void>;
}
