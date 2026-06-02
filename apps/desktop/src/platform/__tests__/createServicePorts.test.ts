// apps/desktop/src/platform/__tests__/createServicePorts.test.ts
// GREEN tests for the desktop createServicePorts cutover
// ().
//
// Asserts:
// • A single shared BackendApiClient is constructed per createServicePorts(deps) call.
// • ports.blockbook(networkId).ping() routes through BackendApiClient.getHealth
// (URL starts with VITE_BACKEND_BASE_URL/api/v1/health — NOT a Blockbook URL).
// • fetchImpl from deps.fetchImpl ?? scopedFetch is invoked exactly once
// (Pitfall C-NEW-09 — the renamed legacy fetch wrapper).
// • setSharedApiClient is called (Pitfall C-NEW-03 + C-NEW-11) — verified
// indirectly via getBlockbookClient returning a non-throwing façade.
// • createDesktopAttestationPort is invoked with { apiClient, networkGate }.
//
// Pattern source: apps/desktop/src/platform/__tests__/attestation.test.ts.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock the attestation port factory BEFORE importing the SUT — vitest
// hoists vi.mock calls.
vi.mock("../attestation", () => ({
  createDesktopAttestationPort: vi.fn(() => ({
    getToken: vi.fn(async () => undefined),
  })),
}));

import { createServicePorts } from "../createServicePorts";
import { createDesktopAttestationPort } from "../attestation";
import {
  __resetBlockbookClientCache,
  getBlockbookClient,
} from "../../lib/getBlockbookClient";

const mockedCreateAttestationPort =
  createDesktopAttestationPort as unknown as Mock;

interface MinimalWalletListStore {
  getState: Mock;
}

function makeMinimalDeps(networkGateOpen: boolean) {
  const networkGate = networkGateOpen
    ? {
        isOpen: () => true,
        subscribe: () => () => {
          /* noop */
        },
      }
    : {
        isOpen: () => false,
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
    // The full WalletSecretsPort surface isn't exercised by these wiring tests;
    // pass an empty stub via `as unknown as` cast (the factory passes it through
    // to ports.secrets unchanged).
    secrets: {} as unknown as Parameters<
      typeof createServicePorts
    >[0]["secrets"],
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

describe("createServicePorts (desktop) ()", () => {
  it("constructs a single shared BackendApiClient per createServicePorts(deps) call", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const deps = makeMinimalDeps(true);
    const ports = createServicePorts({ ...deps, fetchImpl });
    // The shared apiClient install is observable via getBlockbookClient
    // (it would throw "called before createServicePorts" if not installed).
    const facade = getBlockbookClient("btc-testnet");
    expect(facade).toBeDefined();
    expect(typeof facade.ping).toBe("function");
    expect(typeof facade.getAddress).toBe("function");
    expect(typeof facade.getTx).toBe("function");
    // Sanity on the returned ports shape.
    expect(typeof ports.blockbook).toBe("function");
    expect(ports.networkGate).toBe(deps.networkGate);
  });

  it("ports.blockbook(networkId).ping() routes through BackendApiClient.getHealth (not a direct Blockbook URL)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        status: "ok",
        version: "1.0.0",
        uptimeSeconds: 1,
        env: "test",
        dbConnected: true,
      }),
    ) as unknown as typeof fetch;
    const deps = makeMinimalDeps(true);
    const ports = createServicePorts({ ...deps, fetchImpl });

    const status = await ports.blockbook("btc-testnet").ping();

    expect(status.healthy).toBe(true);
    expect(status.networkId).toBe("btc-testnet");
    expect(status.blockbook?.version).toBe("1.0.0");

    // The wire URL must be the backend health endpoint, NOT a Blockbook host.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const fetchMock = fetchImpl as unknown as Mock;
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/v1/health");
    expect(calledUrl).not.toMatch(/blockbook\.|trezor\.io/);
  });

  it("wires fetchImpl from deps.fetchImpl ?? scopedFetch (C-NEW-09)", async () => {
    // When deps.fetchImpl is provided, that fetchImpl MUST be the one called.
    const customFetch = vi.fn(async () =>
      jsonResponse({
        status: "ok",
        version: "1.2.3",
        uptimeSeconds: 1,
        env: "test",
        dbConnected: true,
      }),
    ) as unknown as typeof fetch;
    const deps = makeMinimalDeps(true);
    const ports = createServicePorts({ ...deps, fetchImpl: customFetch });
    await ports.blockbook("btc-testnet").ping();
    expect(customFetch).toHaveBeenCalledTimes(1);
  });

  it("wires attestationToken port from createDesktopAttestationPort", () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const deps = makeMinimalDeps(true);
    createServicePorts({ ...deps, fetchImpl });
    expect(mockedCreateAttestationPort).toHaveBeenCalledTimes(1);
    const opts = mockedCreateAttestationPort.mock.calls[0][0];
    // contract: { apiClient, networkGate }.
    expect(opts).toBeDefined();
    expect(opts.apiClient).toBeDefined();
    expect(opts.networkGate).toBeDefined();
    expect(typeof opts.networkGate.isOpen).toBe("function");
    expect(opts.networkGate.isOpen()).toBe(true);
  });

  it("scaffold loads (sanity)", () => {
    expect(true).toBe(true);
  });
});
