import React, { createContext, useCallback, useContext, useState } from "react";
import {
  BLOCKCHAINS,
  BlockchainConfig,
  NetworkConfig,
  buildDerivationPath,
} from "@prl-wallet/config";
import type { Network } from "bitcoinjs-lib";
import type { AddressService, ServicesPorts } from "@prl-wallet/services";
import { useWalletServices } from "@prl-wallet/app-flows";

const DEFAULT_BLOCKCHAIN = BLOCKCHAINS[0];
const DEFAULT_NETWORK = DEFAULT_BLOCKCHAIN.networks[0];

interface NewWalletContextValue {
  blockchainConfig: BlockchainConfig;
  networkConfig: NetworkConfig;
  network: Network;
  bip86Path: (account?: number, change?: number, index?: number) => string;
  blockbookUrl: string;
  setChain: (blockchain: BlockchainConfig, network: NetworkConfig) => void;
  ports: ServicesPorts;
  addressService: AddressService;
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
  };

  return (
    <NewWalletContext.Provider value={value}>
      {children}
    </NewWalletContext.Provider>
  );
}
