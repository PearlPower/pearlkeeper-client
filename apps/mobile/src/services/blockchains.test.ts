import { BLOCKCHAINS } from "@prl-wallet/config";
import type { BlockchainConfig } from "@prl-wallet/config";
// Assertions about non-enabled chains/networks read the canonical config file
// directly so they survive `enabled: false` flips (bitcoin and prl-testnet are
// currently shipped disabled — those chains/networks are filtered out of the
// `BLOCKCHAINS` runtime export but the schema is still part of the contract).
import blockchainsData from "../../../../packages/config/src/blockchains.json";

const RAW_BLOCKCHAINS = (
  blockchainsData as { blockchains: BlockchainConfig[] }
).blockchains;

describe("blockchains.json config (SC-5)", () => {
  it("prl-mainnet derivationPathTemplate uses m/86 (BIP86), not m/44", () => {
    const prl = BLOCKCHAINS.find((bc) => bc.id === "prl");
    const mainnet = prl?.networks.find((n) => n.id === "prl-mainnet");
    expect(mainnet?.derivationPathTemplate).toBe(
      "m/86'/808276'/{account}'/{change}/{index}",
    );
  });

  it("all enabled networks have a non-empty blockbookUrl", () => {
    for (const bc of BLOCKCHAINS) {
      for (const network of bc.networks) {
        if (network.enabled) {
          expect(network.blockbookUrl).toBeTruthy();
        }
      }
    }
  });

  it("prl-testnet and btc-mainnet already use m/86 (canonical schema)", () => {
    const prl = RAW_BLOCKCHAINS.find((bc) => bc.id === "prl");
    const testnet = prl?.networks.find((n) => n.id === "prl-testnet");
    expect(testnet?.derivationPathTemplate).toMatch(/^m\/86'/);

    const btc = RAW_BLOCKCHAINS.find((bc) => bc.id === "bitcoin");
    const btcMainnet = btc?.networks.find((n) => n.id === "btc-mainnet");
    expect(btcMainnet?.derivationPathTemplate).toMatch(/^m\/86'/);
  });
});

describe("Bitcoin mainnet config (canonical schema)", () => {
  it("btc-mainnet entry exists in blockchains.json", () => {
    const btc = RAW_BLOCKCHAINS.find((bc) => bc.id === "bitcoin");
    const btcMainnet = btc?.networks.find((n) => n.id === "btc-mainnet");
    expect(btcMainnet).toBeDefined();
  });

  it("btc-mainnet bech32 is 'bc'", () => {
    const btc = RAW_BLOCKCHAINS.find((bc) => bc.id === "bitcoin");
    const btcMainnet = btc?.networks.find((n) => n.id === "btc-mainnet");
    expect(btcMainnet?.bitcoinNetwork.bech32).toBe("bc");
  });

  it("btc-mainnet derivationPathTemplate starts with m/86'/0'", () => {
    const btc = RAW_BLOCKCHAINS.find((bc) => bc.id === "bitcoin");
    const btcMainnet = btc?.networks.find((n) => n.id === "btc-mainnet");
    expect(btcMainnet?.derivationPathTemplate).toMatch(/^m\/86'\/0'/);
  });

  it("btc-mainnet bip86CoinType is 0", () => {
    const btc = RAW_BLOCKCHAINS.find((bc) => bc.id === "bitcoin");
    const btcMainnet = btc?.networks.find((n) => n.id === "btc-mainnet");
    expect(btcMainnet?.bip86CoinType).toBe(0);
  });
});
