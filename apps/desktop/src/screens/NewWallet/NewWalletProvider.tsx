// apps/desktop/src/screens/NewWallet/NewWalletProvider.tsx
//
// React context for the create + import wizard branches.
// 1:1 port of apps/mobile/src/screens/NewWallet/NewWalletContext.tsx (W-6 —
// verbatim NewWalletContextValue shape pinned at planning time). Provider is
// mounted in App.tsx ONCE above the conditional <Routes> tree (W-8 + ).

import React, { createContext, useCallback, useContext, useState } from "react";
import {
  BLOCKCHAINS,
  type BlockchainConfig,
  type NetworkConfig,
  buildDerivationPath,
} from "@prl-wallet/config";
import type { Network } from "bitcoinjs-lib";
import type { AddressService, ServicesPorts } from "@prl-wallet/services";
import { useWalletServices } from "@prl-wallet/app-flows";

const DEFAULT_BLOCKCHAIN = BLOCKCHAINS[0];
const DEFAULT_NETWORK = DEFAULT_BLOCKCHAIN.networks[0];

// W-6 — verbatim from apps/mobile/src/screens/NewWallet/NewWalletContext.tsx lines 15-24.
// Field names, field types, and field count must match mobile exactly so the
// create/import flow hooks (which were authored against this shape) work without
// adaptation. Adding or renaming a field is a contract break.
//
// divergence from mobile: desktop adds mnemonic/setMnemonic/clearMnemonic
// to support the SeedVerify Back button (UAT-7). Mobile uses native Stack
// navigation which preserves screen state on back, so it doesn't need
// provider-level mnemonic state. Mobile parity for the rest of the shape is
// preserved.
interface NewWalletContextValue {
  blockchainConfig: BlockchainConfig;
  networkConfig: NetworkConfig;
  network: Network;
  bip86Path: (account?: number, change?: number, index?: number) => string;
  blockbookUrl: string;
  setChain: (blockchain: BlockchainConfig, network: NetworkConfig) => void;
  ports: ServicesPorts;
  addressService: AddressService;
  // : lifted mnemonic state (UAT Test 7 — Back button needs the
  // mnemonic to persist across Seed↔SeedVerify navigation, AND
  // "Notable Non-Findings" notes WalletSetupScreen's `useState(() =>
  // generateMnemonic(128))` is one-shot per mount).
  mnemonic: string | null;
  setMnemonic: (m: string) => void;
  clearMnemonic: () => void;
}

function makeBip86Path(net: NetworkConfig) {
  return (account = 0, change = 0, index = 0) =>
    buildDerivationPath(
      net.bip86CoinType,
      account,
      change,
      index,
      net.derivationPathTemplate,
    );
}

const NewWalletContext = createContext<NewWalletContextValue | null>(null);

export function useNewWalletContext(): NewWalletContextValue {
  const ctx = useContext(NewWalletContext);
  if (!ctx) {
    throw new Error(
      "useNewWalletContext must be used within NewWalletProvider",
    );
  }
  return ctx;
}

type NewWalletProviderProps = {
  children: React.ReactNode;
};

export function NewWalletProvider({ children }: NewWalletProviderProps) {
  const { ports, addressService } = useWalletServices();
  const [blockchainConfig, setBlockchainConfig] =
    useState<BlockchainConfig>(DEFAULT_BLOCKCHAIN);
  const [networkConfig, setNetworkConfig] =
    useState<NetworkConfig>(DEFAULT_NETWORK);
  // : mnemonic lives here for the wizard's full lifetime so Back
  // navigation from /wallet/new/verify → /wallet/new/seed shows the SAME
  // words the user originally saw (UAT-7). clearMnemonic is called only on
  // terminal success (SetupSuccessScreen → resetToRoot), never from Back.
  const [mnemonic, setMnemonicState] = useState<string | null>(null);
  const setMnemonic = useCallback((m: string) => setMnemonicState(m), []);
  const clearMnemonic = useCallback(() => setMnemonicState(null), []);

  const setChain = useCallback(
    (blockchain: BlockchainConfig, net: NetworkConfig) => {
      setBlockchainConfig(blockchain);
      setNetworkConfig(net);
    },
    [],
  );

  const network = networkConfig.bitcoinNetwork as unknown as Network;
  const bip86Path = makeBip86Path(networkConfig);
  const blockbookUrl = networkConfig.blockbookUrl;

  const value: NewWalletContextValue = {
    blockchainConfig,
    networkConfig,
    network,
    bip86Path,
    blockbookUrl,
    setChain,
    ports,
    addressService,
    mnemonic,
    setMnemonic,
    clearMnemonic,
  };

  return (
    <NewWalletContext.Provider value={value}>
      {children}
    </NewWalletContext.Provider>
  );
}
