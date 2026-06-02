// apps/desktop/src/lib/getNetworkInfo.ts
//
// Pure TS helper.
// Verbatim port from apps/mobile/src/screens/WalletList/WalletListScreen.tsx
// lines 25-45 (mobile parity).
//
// Resolves a `networkId` (e.g. "prl-testnet", "btc-mainnet") to the user-facing
// blockchain + network names from `@prl-wallet/config`'s `BLOCKCHAINS` array.

import { BLOCKCHAINS } from "@prl-wallet/config";

export function getNetworkInfo(networkId: string): {
  blockchainName: string;
  networkName: string;
  isTestnet: boolean;
} {
  for (const bc of BLOCKCHAINS) {
    const net = bc.networks.find((n) => n.id === networkId);
    if (net) {
      return {
        blockchainName: bc.name,
        networkName: net.name,
        isTestnet: net.name.toLowerCase().includes("testnet"),
      };
    }
  }
  return {
    blockchainName: "Unknown",
    networkName: "Unknown",
    isTestnet: false,
  };
}
