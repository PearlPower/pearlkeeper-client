import type { WalletType } from "@prl-wallet/app-state";

type WalletIdentity = {
  id: string;
  networkId: string;
};

export type SharedWalletReference =
  | {
      walletId: string;
      networkId: string;
      walletType: "xpub";
      capability: "watchOnly";
    }
  | {
      walletId: string;
      networkId: string;
      walletType: Exclude<WalletType, "xpub">;
      capability: "signing";
    };

export function toWalletReference(
  wallet: WalletIdentity,
  walletType: WalletType,
): SharedWalletReference {
  if (walletType === "xpub") {
    return {
      walletId: wallet.id,
      networkId: wallet.networkId,
      walletType,
      capability: "watchOnly",
    };
  }

  return {
    walletId: wallet.id,
    networkId: wallet.networkId,
    walletType,
    capability: "signing",
  };
}
