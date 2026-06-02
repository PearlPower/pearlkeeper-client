import type { Network } from "bitcoinjs-lib";
import { resolveNetworkContext } from "../network/resolveNetworkContext.js";

describe("services network context", () => {
  it("resolves PRL and Bitcoin network IDs with config metadata and bip86 builders", () => {
    const prl = resolveNetworkContext("prl-mainnet");
    const btc = resolveNetworkContext("btc-mainnet");

    expect(prl.config.id).toBe("prl-mainnet");
    expect(prl.blockchain.id).toBe("prl");
    expect(prl.network).toEqual(
      prl.config.bitcoinNetwork as unknown as Network,
    );
    expect(prl.bip86Path()).toBe("m/86'/808276'/0'/0/0");
    expect(prl.bip86Path(2, 1, 9)).toBe("m/86'/808276'/2'/1/9");

    expect(btc.config.id).toBe("btc-mainnet");
    expect(btc.blockchain.id).toBe("bitcoin");
    expect(btc.network).toEqual(
      btc.config.bitcoinNetwork as unknown as Network,
    );
    expect(btc.bip86Path()).toBe("m/86'/0'/0'/0/0");
    expect(btc.blockbookUrl).toBe(btc.config.blockbookUrl);
  });

  it("throws for missing or unknown network IDs instead of defaulting to PRL", () => {
    expect(() => resolveNetworkContext("")).toThrow(
      "networkId is required to resolve network context",
    );
    expect(() => resolveNetworkContext("unknown-network")).toThrow(
      'Unknown networkId: "unknown-network"',
    );
  });

  it("returns a reusable config-driven context for future services", () => {
    const testnet = resolveNetworkContext("btc-testnet");

    expect(testnet.network).toEqual(
      testnet.config.bitcoinNetwork as unknown as Network,
    );
    expect(testnet.bip86Path(0, 0, 5)).toBe("m/86'/1'/0'/0/5");
    expect(testnet.blockchain.id).toBe("bitcoin");
    expect(testnet.config.derivationPathTemplate).toContain("{account}");
  });
});
