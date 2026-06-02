import type { WalletType } from "../contracts/index.js";

export const SECRET_STORAGE_PORT_METHODS = [
  "getMnemonic",
  "getBIP32Seed",
  "getXpub",
  "getWalletType",
  "storeMnemonic",
  "storeBIP32Seed",
  "storeXpub",
  "storeWalletType",
  "deleteWalletSecrets",
  "getPinHash",
  "storePinHash",
  "deletePinHash",
] as const;

export interface WalletSecretsPort {
  getMnemonic(walletId: string): Promise<string | null>;
  getBIP32Seed(walletId: string): Promise<string | null>;
  getXpub(walletId: string): Promise<string | null>;
  getWalletType(walletId: string): Promise<WalletType | null>;
  storeMnemonic(walletId: string, mnemonic: string): Promise<void>;
  storeBIP32Seed(walletId: string, seed: string): Promise<void>;
  storeXpub(walletId: string, xpub: string): Promise<void>;
  storeWalletType(walletId: string, type: WalletType): Promise<void>;
  deleteWalletSecrets(walletId: string): Promise<void>;
  getPinHash(): Promise<string | null>;
  storePinHash(hash: string): Promise<void>;
  deletePinHash(): Promise<void>;
}
