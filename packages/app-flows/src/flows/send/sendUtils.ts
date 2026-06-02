import type { WalletType } from "@prl-wallet/app-state";
import { toWalletReference } from "../walletReferences.js";

export type SigningWalletReference = {
  walletId: string;
  networkId: string;
  walletType: Exclude<WalletType, "xpub">;
  capability: "signing";
};

export function parseQRData(data: string, bip21Prefix: string): string {
  const scheme = bip21Prefix ? `${bip21Prefix}:` : "";
  if (scheme && data.startsWith(scheme)) {
    return data.slice(scheme.length).split("?")[0] ?? data.slice(scheme.length);
  }
  return data.trim();
}

export function toSigningWalletReference(
  wallet: { id: string; networkId: string },
  walletType: WalletType,
): SigningWalletReference {
  const walletReference = toWalletReference(wallet, walletType);
  if (walletReference.capability !== "signing") {
    throw new Error("Cannot sign transaction with this wallet type");
  }
  return walletReference;
}
