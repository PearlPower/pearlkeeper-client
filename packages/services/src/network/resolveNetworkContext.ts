import { BLOCKCHAINS, buildDerivationPath } from "@prl-wallet/config";
import type { BlockchainConfig, NetworkConfig } from "@prl-wallet/config";
import type { Network } from "bitcoinjs-lib";

export interface NetworkContext {
  blockchain: BlockchainConfig;
  config: NetworkConfig;
  network: Network;
  blockbookUrl: string;
  bip86Path(account?: number, change?: number, index?: number): string;
}

let activeBlockchains: BlockchainConfig[] = BLOCKCHAINS;

/**
 * Test-only seam: swap the chains/networks `resolveNetworkContext` iterates.
 * Mirrors the backend `__setBlockchainsSourceForTests` pattern so tests can
 * resolve network IDs (e.g. `btc-mainnet`, `prl-testnet`) that production
 * `BLOCKCHAINS` filters out. Pass `undefined` to restore the real
 * `@prl-wallet/config` export.
 */
export function __setBlockchainsForTests(
  value: BlockchainConfig[] | undefined,
): void {
  activeBlockchains = value ?? BLOCKCHAINS;
}

export function resolveNetworkContext(networkId: string): NetworkContext {
  if (!networkId) {
    throw new Error("networkId is required to resolve network context");
  }

  const match = activeBlockchains
    .flatMap((blockchain) =>
      blockchain.networks.map((config) => ({ blockchain, config })),
    )
    .find(({ config }) => config.id === networkId);

  if (!match) {
    throw new Error(`Unknown networkId: "${networkId}"`);
  }

  const { blockchain, config } = match;

  return {
    blockchain,
    config,
    network: config.bitcoinNetwork as unknown as Network,
    blockbookUrl: config.blockbookUrl,
    bip86Path: (account = 0, change = 0, index = 0) =>
      buildDerivationPath(
        config.bip86CoinType,
        account,
        change,
        index,
        config.derivationPathTemplate,
      ),
  };
}
