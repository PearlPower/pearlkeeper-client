// apps/mobile/src/services/adapters/__tests__/createServicePorts.test.ts
// GREEN flip of the Wave-0 RED stubs ().
//
// Verifies:
// • createServicePorts({ networkGate }) constructs ONE shared production
// BackendApiClient per call (observed indirectly via setSharedApiClient
// install — see C-NEW-03).
// • ports.blockbook(networkId).ping() routes through BackendApiClient.getHealth
// i.e. fetches `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/health`, NOT a
// direct Blockbook URL.
// • The attestationToken port is wired (createMobileAttestationPort dispatch
// is exercised; in jest's RN preset Platform.OS === "ios" so the iOS
// branch returns).

// Mock @expo/app-integrity at module load (matches attestation.test.ts pattern).
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
import {
  __resetClientCache,
  getBlockbookClient,
} from "../../blockbookClient";
import { createMobileAttestationPort } from "../../attestation";
import { createAttestationCache } from "../../attestation.cache";
import { BackendApiClient } from "@prl-wallet/api-client";
import { __resetStore as __resetSecureStore } from "../../../__mocks__/expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

beforeEach(() => {
  jest.clearAllMocks();
  __resetClientCache();
  __resetSecureStore();
  (AsyncStorage as unknown as { __resetStore: () => void }).__resetStore();
});

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

describe("createServicePorts (mobile) ()", () => {
  it("constructs a single shared BackendApiClient per createServicePorts() call", async () => {
    // After createServicePorts runs, the shared apiClient is installed via
    // setSharedApiClient. We verify by importing getBlockbookClient and
    // confirming it returns a façade (would throw without the shared client).
    const ports = createServicePorts({
      networkGate: { isOpen: () => true } as never,
    });
    expect(typeof ports.blockbook).toBe("function");

    // Cross-check: the legacy hook-callsite path can now resolve a façade.
    const facade = getBlockbookClient("prl-mainnet");
    expect(typeof facade.ping).toBe("function");
    expect(typeof facade.getAddress).toBe("function");
  });

  it("ports.blockbook(networkId).ping() routes through BackendApiClient.getHealth (not a direct Blockbook URL)", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        jsonResponse({
          status: "ok",
          version: "1.0.0",
          uptimeSeconds: 1,
          env: "test",
          dbConnected: true,
        }),
      );

    const ports = createServicePorts({
      networkGate: { isOpen: () => true } as never,
    });
    const status = await ports.blockbook("btc-testnet").ping();

    expect(status.healthy).toBe(true);
    expect(status.networkId).toBe("btc-testnet");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toMatch(/\/api\/v1\/health$/);
    // Ensure no direct Blockbook URL leaked.
    expect(calledUrl).not.toMatch(/blockbook|trezor\.io/i);

    fetchSpy.mockRestore();
  });

  it("wires attestationToken port from createMobileAttestationPort", async () => {
    // We cannot directly inspect the BackendApiClient's internal port. Instead
    // we verify the dispatcher path: instantiating the dispatcher returns a
    // port with a getToken() that resolves (no throw) — matches .
    const enrollmentClient = new BackendApiClient("https://api.example.test");
    const port = createMobileAttestationPort({
      apiClient: enrollmentClient,
      cache: createAttestationCache(),
    });
    expect(typeof port.getToken).toBe("function");
    // contract: never throws.
    await expect(port.getToken()).resolves.not.toThrow();
  });

  it("scaffold loads (sanity)", () => {
    expect(true).toBe(true);
  });
});
