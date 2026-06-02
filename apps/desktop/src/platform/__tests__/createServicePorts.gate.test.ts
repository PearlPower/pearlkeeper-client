// apps/desktop/src/platform/__tests__/createServicePorts.gate.test.ts
// GREEN tests for (network gate preserved on desktop).
//
// Asserts:
// • Closed networkGate causes ports.blockbook(networkId) methods to throw
// BackendOfflineError BEFORE any fetchImpl invocation ( layer 3
// guarantee preserved through the cutover).
// • Open networkGate calls scopedFetch (the injected fetchImpl) exactly once
// on a port method call.
//
// Pattern source: apps/desktop/src/platform/__tests__/networkGate.test.ts.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { BackendOfflineError } from "@prl-wallet/api-client";

vi.mock("../attestation", () => ({
  createDesktopAttestationPort: vi.fn(() => ({
    getToken: vi.fn(async () => undefined),
  })),
}));

import { createServicePorts } from "../createServicePorts";
import { __resetBlockbookClientCache } from "../../lib/getBlockbookClient";

interface MinimalWalletListStore {
  getState: Mock;
}

function makeMinimalDeps(networkGateOpen: boolean) {
  const networkGate = {
    isOpen: () => networkGateOpen,
    subscribe: () => () => {
      /* noop */
    },
  };
  const walletListStore: MinimalWalletListStore = {
    getState: vi.fn(() => ({
      wallets: [],
      activeWalletId: null,
      addWallet: vi.fn(),
      removeWallet: vi.fn(),
      setActiveWalletId: vi.fn(),
      updateWalletBalance: vi.fn(),
    })),
  };
  return {
    secrets: {} as Parameters<typeof createServicePorts>[0]["secrets"],
    walletListStore: walletListStore as unknown as Parameters<
      typeof createServicePorts
    >[0]["walletListStore"],
    networkGate,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetBlockbookClientCache();
});

describe("createServicePorts (desktop) — networkGate ()", () => {
  it("closed networkGate throws BackendOfflineError BEFORE fetchImpl invoked (desktop)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        address: "tb1q...",
        balance: "0",
        unconfirmedBalance: "0",
        txs: 0,
        transactions: [],
        page: 1,
        totalPages: 0,
        itemsOnPage: 25,
      }),
    ) as unknown as typeof fetch;
    const deps = makeMinimalDeps(/* networkGateOpen */ false);
    const ports = createServicePorts({ ...deps, fetchImpl });

    // BlockbookPort.getAddress signature: (address, page?, pageSize?).
    await expect(
      ports.blockbook("btc-testnet").getAddress("tb1qclosedgate"),
    ).rejects.toBeInstanceOf(BackendOfflineError);

    // layer 3: fetch MUST NOT have been invoked.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("open networkGate calls scopedFetch exactly once", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        address: "tb1qopen",
        balance: "0",
        unconfirmedBalance: "0",
        txs: 0,
        transactions: [],
        page: 1,
        totalPages: 0,
        itemsOnPage: 25,
      }),
    ) as unknown as typeof fetch;
    const deps = makeMinimalDeps(/* networkGateOpen */ true);
    const ports = createServicePorts({ ...deps, fetchImpl });

    await ports.blockbook("btc-testnet").getAddress("tb1qopen");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const fetchMock = fetchImpl as unknown as Mock;
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/v1/indexer/btc-testnet/address/tb1qopen");
  });

  it("scaffold loads (sanity)", () => {
    expect(true).toBe(true);
  });
});
