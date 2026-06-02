// apps/mobile/src/services/blockbookClient.test.ts
// replaces the legacy cache-behavior tests with the
// post-cutover façade contract:
// • getBlockbookClient throws if setSharedApiClient hasn't been called
// (the apps/mobile/src/services/adapters/createServicePorts.ts boot
// installs the shared client; tests that bypass that path see the
// installer-missing error and know to set up the shared client).
// • getBlockbookClient returns a fresh façade per call (no caching;
// façades are cheap object literals — lock).
// • getBlockbookClient honors the BlockbookClientLike public surface
// so the 7 mobile hook callsites compile unchanged.
//
// The legacy "cached client per networkId" + "throws for unknown networkId"
// behaviors are gone — the BackendApiClient owns network resolution now,
// and the façade is a pure projection.

import {
  getBlockbookClient,
  setSharedApiClient,
  __resetClientCache,
} from "./blockbookClient";
import { BackendApiClient } from "@prl-wallet/api-client";

beforeEach(() => {
  __resetClientCache();
});

describe("getBlockbookClient ( façade — Pitfall C-NEW-03)", () => {
  it("throws a clear error when setSharedApiClient hasn't been called", () => {
    expect(() => getBlockbookClient("prl-mainnet")).toThrow(
      /createServicePorts/,
    );
  });

  it("returns a façade with the BlockbookClientLike public surface", () => {
    const apiClient = new BackendApiClient("https://example.test");
    setSharedApiClient(apiClient);
    const client = getBlockbookClient("prl-mainnet");
    expect(typeof client.ping).toBe("function");
    expect(typeof client.getAddress).toBe("function");
    expect(typeof client.getTx).toBe("function");
    expect(typeof client.getUtxos).toBe("function");
    expect(typeof client.estimateFee).toBe("function");
    expect(typeof client.sendTx).toBe("function");
  });

  it("returns a fresh façade object per call (no caching — purity)", () => {
    const apiClient = new BackendApiClient("https://example.test");
    setSharedApiClient(apiClient);
    const a = getBlockbookClient("prl-mainnet");
    const b = getBlockbookClient("prl-mainnet");
    expect(a).not.toBe(b);
  });

  it("ignores the networkGate arg (gate lives on the shared apiClient now)", () => {
    const apiClient = new BackendApiClient("https://example.test");
    setSharedApiClient(apiClient);
    // Should not throw; the arg is accepted for backward compat but unused.
    const client = getBlockbookClient("btc-mainnet", { isOpen: () => false });
    expect(typeof client.ping).toBe("function");
  });
});
