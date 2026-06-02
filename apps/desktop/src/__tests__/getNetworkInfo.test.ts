// apps/desktop/src/__tests__/getNetworkInfo.test.ts
//
// Task 1 — pure-helper unit test (mobile parity).
// Resolves real networkIds from packages/config/src/blockchains.json and
// asserts the Unknown placeholder for ids not present.

import { describe, test, expect } from "vitest";
import { getNetworkInfo } from "@/lib/getNetworkInfo";
import { BLOCKCHAINS } from "@prl-wallet/config";

describe("getNetworkInfo", () => {
  test("returns Unknown placeholder for non-existent networkId", () => {
    expect(getNetworkInfo("does-not-exist")).toEqual({
      blockchainName: "Unknown",
      networkName: "Unknown",
      isTestnet: false,
    });
  });

  test("resolves the first real networkId from blockchains.json", () => {
    const firstChain = BLOCKCHAINS[0];
    const firstNetwork = firstChain.networks[0];
    const result = getNetworkInfo(firstNetwork.id);
    expect(result.blockchainName).toBe(firstChain.name);
    expect(result.networkName).toBe(firstNetwork.name);
    expect(result.isTestnet).toBe(
      firstNetwork.name.toLowerCase().includes("testnet"),
    );
  });

  test("flags a network whose name contains 'testnet' as isTestnet=true", () => {
    // Walk every chain looking for a testnet entry — the test is independent of
    // which specific chains/networks are enabled in blockchains.json.
    let foundTestnet = false;
    for (const bc of BLOCKCHAINS) {
      for (const net of bc.networks) {
        if (net.name.toLowerCase().includes("testnet")) {
          const result = getNetworkInfo(net.id);
          expect(result.isTestnet).toBe(true);
          expect(result.blockchainName).toBe(bc.name);
          expect(result.networkName).toBe(net.name);
          foundTestnet = true;
          break;
        }
      }
      if (foundTestnet) break;
    }
    expect(foundTestnet).toBe(true);
  });
});
