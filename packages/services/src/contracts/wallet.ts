import type { AddressDiscoveryResult } from "./address.js";

export const SIGNABLE_WALLET_TYPES = ["mnemonic", "wif", "bip32Seed"] as const;
export const WATCH_ONLY_WALLET_TYPES = ["xpub"] as const;
export const WALLET_CAPABILITIES = ["signing", "watchOnly"] as const;

export type SignableWalletType = (typeof SIGNABLE_WALLET_TYPES)[number];
export type WatchOnlyWalletType = (typeof WATCH_ONLY_WALLET_TYPES)[number];
export type WalletType = SignableWalletType | WatchOnlyWalletType;
export type WalletCapability = (typeof WALLET_CAPABILITIES)[number];

export interface WalletRecord {
  id: string;
  name: string;
  networkId: string;
  createdAt: number;
  lastKnownBalance?: string;
}

export interface PrepareCreateWalletInput {
  networkId: string;
  walletType: SignableWalletType;
}

export interface CommitCreateWalletInput {
  name: string;
  draft: CreateWalletDraft;
}

export interface ImportMnemonicWalletInput {
  name: string;
  networkId: string;
  walletType: "mnemonic";
  mnemonic: string;
}

export interface ImportBip32SeedWalletInput {
  name: string;
  networkId: string;
  walletType: "bip32Seed";
  seed: string;
}

export interface ImportWatchOnlyWalletInput {
  name: string;
  networkId: string;
  walletType: WatchOnlyWalletType;
  xpub: string;
}

export type ImportWalletInput =
  | ImportMnemonicWalletInput
  | ImportBip32SeedWalletInput
  | ImportWatchOnlyWalletInput;

interface BaseWalletReference {
  walletId: string;
  networkId: string;
}

export interface SignableWalletReference extends BaseWalletReference {
  walletType: SignableWalletType;
  capability: "signing";
}

export interface WatchOnlyWalletReference extends BaseWalletReference {
  walletType: WatchOnlyWalletType;
  capability: "watchOnly";
}

export type WalletReference =
  | SignableWalletReference
  | WatchOnlyWalletReference;

export interface CreateWalletDraft {
  walletId: string;
  networkId: string;
  walletType: "mnemonic";
  capability: "signing";
  mnemonic: string;
  firstReceiveAddress: string;
  discovery?: AddressDiscoveryResult;
}

export interface ImportBip32SeedWalletDraft {
  walletId: string;
  networkId: string;
  walletType: "bip32Seed";
  capability: "signing";
  firstReceiveAddress: string;
  discovery?: AddressDiscoveryResult;
}

export interface ImportWatchOnlyWalletDraft {
  walletId: string;
  name: string;
  networkId: string;
  walletType: WatchOnlyWalletType;
  capability: "watchOnly";
  xpub: string;
  discovery?: AddressDiscoveryResult;
}

export type WalletDraft =
  | CreateWalletDraft
  | ImportBip32SeedWalletDraft
  | ImportWatchOnlyWalletDraft;
