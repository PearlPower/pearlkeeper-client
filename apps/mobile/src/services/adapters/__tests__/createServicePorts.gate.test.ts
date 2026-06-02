// apps/mobile/src/services/adapters/__tests__/createServicePorts.gate.test.ts
// GREEN flip of the Wave-0 RED stubs ().
//
// Verifies the four-layer offline-honest gate is preserved at the
// BackendApiClient seam:
// • Closed networkGate causes ports.blockbook(networkId).getAddress(...)
// to throw BackendOfflineError BEFORE any fetch call (layer 3 short-
// circuits before the socket opens).
// • Open networkGate allows the call to invoke fetch exactly once.

jest.mock("@expo/app-integrity", () => ({
  __esModule: true,
  isSupported: false,
  generateKeyAsync: jest.fn(),
  attestKeyAsync: jest.fn(),
  generateAssertionAsync: jest.fn(),
  prepareIntegrityTokenProviderAsync: jest.fn(),
  requestIntegrityCheckAsync: jest.fn(),
}));

import { createServicePorts } from "../createServicePorts";
import { __resetClientCache } from "../../blockbookClient";
import { __resetStore as __resetSecureStore } from "../../../__mocks__/expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BackendOfflineError } from "@prl-wallet/api-client";

beforeEach(() => {
  jest.clearAllMocks();
  __resetClientCache();
  __resetSecureStore();
  (AsyncStorage as unknown as { __resetStore: () => void }).__resetStore();
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("createServicePorts (mobile) — networkGate ()", () => {
  it("closed networkGate causes ports.blockbook(networkId).getAddress(...) to throw BackendOfflineError BEFORE fetchImpl is invoked", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(
      async () => jsonResponse({}),
    );

    const ports = createServicePorts({
      networkGate: { isOpen: () => false } as never,
    });

    await expect(
      ports.blockbook("btc-testnet").getAddress("tb1qexample"),
    ).rejects.toBeInstanceOf(BackendOfflineError);

    // layer 3 — fetch must NOT be called when the gate is closed.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("open networkGate allows ports.blockbook(networkId).getAddress(...) to call fetchImpl exactly once", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        jsonResponse({
          address: "tb1qexample",
          balance: "0",
          unconfirmedBalance: "0",
          txs: 0,
          transactions: [],
          page: 1,
          totalPages: 0,
          itemsOnPage: 1,
        }),
    );

    const ports = createServicePorts({
      networkGate: { isOpen: () => true } as never,
    });

    await ports.blockbook("btc-testnet").getAddress("tb1qexample");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toMatch(/\/api\/v1\/indexer\/btc-testnet\/address\//);
    fetchSpy.mockRestore();
  });

  it("scaffold loads (sanity)", () => {
    expect(true).toBe(true);
  });
});
