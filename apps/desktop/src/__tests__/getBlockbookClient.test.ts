// apps/desktop/src/__tests__/getBlockbookClient.test.ts
//
// regression test (UAT Test 1, 2026-04-28) — -cutover-aware.
//
// PRE-PHASE-28 (this file's original purpose): asserted that
// getBlockbookClient threaded its 4th constructor arg (fetchImpl) through to
// the BlockbookClient so the Tauri WebView would not fall back to globalThis.fetch
// (which CORS-rejects all Blockbook traffic).
//
// POST-PHASE-28 ( / ): getBlockbookClient no longer
// constructs a real BlockbookClient. It returns a BlockbookClient-shaped
// façade (createBackendBlockbookClient from @prl-wallet/api-client) backed
// by the shared BackendApiClient owned by createServicePorts. The fetchImpl
// argument is preserved on the signature for backward-compat but ignored —
// the underlying BackendApiClient holds the real fetchImpl (scopedFetch).
//
// The guarantee survives the cutover via a different invariant:
// because the shared BackendApiClient is constructed in createServicePorts
// with `fetchImpl: deps.fetchImpl ?? scopedFetch`, the Tauri WebView still
// routes EVERY request through @tauri-apps/plugin-http. globalThis.fetch is
// never consulted. We assert that here against the shared apiClient path.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BLOCKCHAINS } from "@prl-wallet/config";
import { BackendApiClient } from "@prl-wallet/api-client";
import {
  getBlockbookClient,
  setSharedApiClient,
  __resetBlockbookClientCache,
} from "@/lib/getBlockbookClient";

const validNetworkId = BLOCKCHAINS[0].networks[0].id;
const validAddress = "prl1qfakeaddressfortesting00000000000000000000";

function makeFakeAddressResponse() {
  // Wire AddressResponse shape (): the backend's indexer
  // address endpoint returns this exact shape, validated by AddressResponseSchema.
  return new Response(
    JSON.stringify({
      address: validAddress,
      balance: "0",
      unconfirmedBalance: "0",
      txs: 0,
      transactions: [],
      page: 1,
      totalPages: 0,
      itemsOnPage: 25,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe(" ( cutover-aware): getBlockbookClient → façade backed by shared apiClient", () => {
  beforeEach(() => {
    __resetBlockbookClientCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    __resetBlockbookClientCache();
  });

  test("calls injected fetchImpl, NOT globalThis.fetch, on getAddress() — via shared apiClient", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const fetchImplSpy = vi.fn(async () => makeFakeAddressResponse());

    // Construct the production wiring: a BackendApiClient with the
    // injected fetchImpl, installed as the shared apiClient.
    const apiClient = new BackendApiClient("https://www.pearlkeeper.com", {
      fetchImpl: fetchImplSpy as unknown as typeof fetch,
      networkGate: { isOpen: () => true },
    });
    setSharedApiClient(apiClient);

    const client = getBlockbookClient(validNetworkId);
    await client.getAddress(validAddress, 1, 1);

    expect(fetchImplSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("URL passed to fetchImpl points at the configured backend host (NOT a Blockbook host)", async () => {
    const fetchImplSpy: typeof fetch = vi.fn(async () =>
      makeFakeAddressResponse(),
    );
    const apiClient = new BackendApiClient("https://www.pearlkeeper.com", {
      fetchImpl: fetchImplSpy,
      networkGate: { isOpen: () => true },
    });
    setSharedApiClient(apiClient);

    const client = getBlockbookClient(validNetworkId);
    await client.getAddress(validAddress, 1, 1);

    const mockedSpy = fetchImplSpy as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = String(mockedSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("https://www.pearlkeeper.com/api/v1/indexer/");
    expect(calledUrl).toContain(validAddress);
    // : the URL must NOT be a direct Blockbook host.
    expect(calledUrl).not.toMatch(
      /(blockbook\.[a-z][a-z0-9-]*\.[a-z]{2,})|([a-z0-9-]+\.trezor\.io)|([a-z0-9-]+\.pearlresearch\.ai\/api\/v2)/,
    );
  });

  test("getBlockbookClient returns a fresh façade per call — no per-networkId caching", () => {
    const apiClient = new BackendApiClient("https://www.pearlkeeper.com", {
      fetchImpl: (async () =>
        makeFakeAddressResponse()) as unknown as typeof fetch,
      networkGate: { isOpen: () => true },
    });
    setSharedApiClient(apiClient);
    const a = getBlockbookClient(validNetworkId);
    const b = getBlockbookClient(validNetworkId);
    // façade: each call returns a fresh closure (no cache). This
    // is intentional — the underlying BackendApiClient is the singleton; the
    // façade itself is tiny and stateless.
    expect(a).not.toBe(b);
    // But the surface is identical — both expose the same method names.
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  });

  test("__resetBlockbookClientCache clears the shared apiClient — subsequent call throws until re-installed", () => {
    const apiClient = new BackendApiClient("https://www.pearlkeeper.com", {
      fetchImpl: (async () =>
        makeFakeAddressResponse()) as unknown as typeof fetch,
      networkGate: { isOpen: () => true },
    });
    setSharedApiClient(apiClient);
    expect(() => getBlockbookClient(validNetworkId)).not.toThrow();
    __resetBlockbookClientCache();
    expect(() => getBlockbookClient(validNetworkId)).toThrow(
      /called before createServicePorts/,
    );
  });

  test("getBlockbookClient throws if called before createServicePorts installs the shared apiClient", () => {
    // Cache is reset in beforeEach — no shared apiClient installed.
    expect(() => getBlockbookClient("not-a-real-network")).toThrow(
      /called before createServicePorts/,
    );
  });
});
