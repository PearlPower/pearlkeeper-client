import { BLOCKCHAINS } from "@prl-wallet/config";
import type { Network } from "bitcoinjs-lib";

/**
 * Lightweight network metadata resolver. Intentionally avoids pulling
 * `@prl-wallet/services` at runtime — that barrel transitively imports
 * `@prl-wallet/core`, which pulls bitcoinjs-lib / bip32 / uint8array-tools
 * and breaks mobile Jest's CommonJS-only runtime. Only `@prl-wallet/config`
 * (pure data, zero crypto deps) is touched at runtime. The returned `network`
 * comes straight from the blockchain config entry, typed as the bitcoinjs-lib
 * `Network` (type-only import — erased at build time).
 */
export function getNetworkMetadata(networkId: string) {
  const match = BLOCKCHAINS.flatMap((blockchain) =>
    blockchain.networks.map((config) => ({ blockchain, config })),
  ).find(({ config }) => config.id === networkId);

  if (!match) {
    throw new Error(`Unknown networkId: "${networkId}"`);
  }

  const { blockchain, config } = match;
  const isTestnet = config.name.toLowerCase() === "testnet";

  return {
    network: config.bitcoinNetwork as unknown as Network,
    networkName: config.name,
    blockchainLabel: blockchain.name,
    networkLabel: isTestnet
      ? `${blockchain.name} ${config.name}`
      : blockchain.name,
    badgeLabel: isTestnet ? config.name : null,
    bip21Prefix: blockchain.id,
    /**
     * Chain-level symbol from blockchains.json (e.g. "BTC", "PRL"). Use this
     * for price-feed routing and balance labels — it stays stable across
     * mainnet/testnet of the same chain. For per-network symbols including
     * the testnet prefix ("tBTC", "tPRL"), use `networkSymbol` instead.
     */
    assetSymbol: blockchain.assetSymbol,
    /**
     * Per-network symbol from blockchains.json (e.g. "BTC", "tBTC", "PRL",
     * "tPRL"). Use when the testnet prefix matters; otherwise prefer
     * `assetSymbol`.
     */
    networkSymbol: config.symbol,
    // Bech32 HRP from the bitcoinNetwork config (bc/tb/prl/tprl).
    // Used for the on-screen recipient-address placeholder (e.g. "tb1...").
    bech32Hrp: config.bitcoinNetwork.bech32,
  };
}
