// apps/mobile/src/services/__tests__/attestation.test.ts
// fulfill Wave-0 RED stubs from .
//
// Stub coverage:
// • iOS keyId persistence + DCError.invalidKey re-enroll (ATTEST-01).
// • iOS body-binding via symmetric pre-image (C-CORR-02).
// • iOS return shape `{ token: 'ios.<keyId>.<assertion>', challenge }`
// per C-CORR-07 (NOT plain string).
// • Android prepare-once + per-request integrity check with
// requestHash = base64url(SHA256(<base64(body)>.<challenge>)) — no
// separate header (C-CORR-03).
// • Android return shape `{ token: 'android.<integrityToken>', challenge }`.
// • Cache state machine: idle → enrolled (offline-first launch, ATTEST-07).
// • Cache backoff schedule (1m / 5m / 30m / 6h) for failed attempts.
// • instance_id persisted via AsyncStorage (NOT SecureStore — lock).
//
// Mock pattern: jest.mock("@expo/app-integrity") inline; SecureStore +
// AsyncStorage are wired via jest.config.js moduleNameMapper to in-tree
// __mocks__ implementations (matches secureStorage.test.ts analog).

jest.mock("@expo/app-integrity", () => ({
  __esModule: true,
  isSupported: true,
  generateKeyAsync: jest.fn(),
  attestKeyAsync: jest.fn(),
  generateAssertionAsync: jest.fn(),
  prepareIntegrityTokenProviderAsync: jest.fn(),
  requestIntegrityCheckAsync: jest.fn(),
}));

import * as ExpoAppIntegrityImport from "@expo/app-integrity";
import {
  createIosAttestationPort,
  createAndroidAttestationPort,
} from "../attestation";
import {
  createAttestationCache,
  BACKOFF_MS,
} from "../attestation.cache";
import { __resetStore as __resetSecureStore } from "../../__mocks__/expo-secure-store";

// Pull mock fns with proper Jest typing.
const ExpoAppIntegrity = ExpoAppIntegrityImport as unknown as {
  isSupported: boolean;
  generateKeyAsync: jest.Mock;
  attestKeyAsync: jest.Mock;
  generateAssertionAsync: jest.Mock;
  prepareIntegrityTokenProviderAsync: jest.Mock;
  requestIntegrityCheckAsync: jest.Mock;
};

// Lazy-require mocked SecureStore + AsyncStorage so the type-erasing import is
// fresh per file. moduleNameMapper rewrites the imports to the __mocks__.
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// API-client stub. The production file imports `BackendApiClient` as a TYPE
// only, so any compatible shape works at runtime (Jest is JS — types erased).
function makeMockApiClient() {
  return {
    getAttestationChallenge: jest
      .fn()
      .mockResolvedValue({ challenge: "chal-1", expiresAt: Date.now() + 30000 }),
    enrollIos: jest.fn(async (req: { keyId: string }) => ({
      instanceId: req.keyId,
      attestationLevel: 1 as const,
    })),
    enrollAndroid: jest
      .fn()
      .mockResolvedValue({
        instanceId: "android-instance-1",
        attestationLevel: 1 as const,
      }),
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  __resetSecureStore();
  // Hard-reset AsyncStorage between tests (the mock exposes a __resetStore
  // helper; cast through unknown to satisfy the public type).
  (AsyncStorage as unknown as { __resetStore: () => void }).__resetStore();
  ExpoAppIntegrity.isSupported = true;
});

// ─── iOS port ────────────────────────────────────────────────────────────────

describe("createIosAttestationPort (, ATTEST-01, C-CORR-07)", () => {
  it("first call: generateKeyAsync + attestKeyAsync(<base64(body)>.<challenge>) → enrollIos → persists keyId in SecureStore (C-CORR-01)", async () => {
    ExpoAppIntegrity.generateKeyAsync.mockResolvedValueOnce("KEY_ID_42");
    ExpoAppIntegrity.attestKeyAsync.mockResolvedValueOnce("ATTESTATION_BLOB");
    const cache = createAttestationCache();
    const apiClient = makeMockApiClient();
    const port = createIosAttestationPort({
      apiClient: apiClient as never,
      cache,
    });

    const bodyBytes = new TextEncoder().encode('{"x":1}');
    const result = await port.getToken({ bodyBytes });

    // First call returns undefined — enrollment fired, request goes tier 0.
    expect(result).toBeUndefined();

    // Symmetric pre-image: <base64(body)>.<challenge>.
    const expectedB64Body = globalThis.btoa('{"x":1}');
    expect(ExpoAppIntegrity.attestKeyAsync).toHaveBeenCalledTimes(1);
    expect(ExpoAppIntegrity.attestKeyAsync).toHaveBeenCalledWith(
      "KEY_ID_42",
      `${expectedB64Body}.chal-1`,
    );

    // enrollIos called with keyId + attestation + the bare server challenge.
    expect(apiClient.enrollIos).toHaveBeenCalledWith({
      keyId: "KEY_ID_42",
      attestation: "ATTESTATION_BLOB",
      challenge: "chal-1",
    });

    // KeyId persisted in SecureStore under the documented key.
    expect(await SecureStore.getItemAsync("prl_attestation_ios_keyId")).toBe(
      "KEY_ID_42",
    );

    // Cache flipped to enrolled with the returned instanceId.
    expect(await cache.isEnrolled()).toBe(true);
    expect(await cache.getInstanceId()).toBe("KEY_ID_42");
  });

  it("subsequent call: generateAssertionAsync(keyId, <base64(body)>.<challenge>) → returns { token: 'ios.<keyId>.<assertion>', challenge } (, C-CORR-07)", async () => {
    // Pre-seed SecureStore so the port takes the per-request path.
    await SecureStore.setItemAsync("prl_attestation_ios_keyId", "KEY_ID_42");
    ExpoAppIntegrity.generateAssertionAsync.mockResolvedValueOnce(
      "ASSERTION_BLOB",
    );
    const cache = createAttestationCache();
    const port = createIosAttestationPort({
      apiClient: makeMockApiClient() as never,
      cache,
    });

    const bodyBytes = new TextEncoder().encode("payload");
    const result = await port.getToken({ bodyBytes });

    expect(result).toEqual({
      token: "ios.KEY_ID_42.ASSERTION_BLOB",
      challenge: "chal-1",
    });

    // Verify symmetric pre-image was passed to generateAssertionAsync.
    const expectedB64Body = globalThis.btoa("payload");
    expect(ExpoAppIntegrity.generateAssertionAsync).toHaveBeenCalledWith(
      "KEY_ID_42",
      `${expectedB64Body}.chal-1`,
    );
  });

  it("getToken returns { token, challenge } shape per C-CORR-07 (NOT plain string)", async () => {
    await SecureStore.setItemAsync("prl_attestation_ios_keyId", "KEY_2");
    ExpoAppIntegrity.generateAssertionAsync.mockResolvedValueOnce("A2");
    const cache = createAttestationCache();
    const port = createIosAttestationPort({
      apiClient: makeMockApiClient() as never,
      cache,
    });

    const result = await port.getToken();

    // Shape: object with both keys, NOT a bare string.
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
    expect(typeof result?.token).toBe("string");
    expect(typeof result?.challenge).toBe("string");
    expect(result?.token).toBe("ios.KEY_2.A2");
    expect(result?.challenge).toBe("chal-1");
  });

  it("ERR_APP_INTEGRITY_INVALID_KEY → clear keyId from SecureStore + trigger re-enrollment (ATTEST-01, )", async () => {
    await SecureStore.setItemAsync("prl_attestation_ios_keyId", "OLD_KEY");
    const err = new Error("invalid key") as Error & { code?: string };
    err.code = "ERR_APP_INTEGRITY_INVALID_KEY";
    ExpoAppIntegrity.generateAssertionAsync.mockRejectedValueOnce(err);
    const cache = createAttestationCache();
    // Pre-mark cache enrolled — the invalid-key path must reset it to idle.
    await cache.setStatus("enrolled", "OLD_KEY");

    const port = createIosAttestationPort({
      apiClient: makeMockApiClient() as never,
      cache,
    });
    const result = await port.getToken();

    expect(result).toBeUndefined();
    // KeyId cleared so next call triggers re-enrollment.
    expect(await SecureStore.getItemAsync("prl_attestation_ios_keyId")).toBeNull();
    // Cache flipped back to idle.
    expect(await cache.getStatus()).toBe("idle");
  });

  it("getToken NEVER throws — error path returns undefined ( contract preserved)", async () => {
    // Force the very first await (challenge fetch) to reject.
    const apiClient = makeMockApiClient();
    apiClient.getAttestationChallenge.mockRejectedValueOnce(
      new Error("network down"),
    );
    const cache = createAttestationCache();
    const port = createIosAttestationPort({
      apiClient: apiClient as never,
      cache,
    });

    await expect(port.getToken()).resolves.toBeUndefined();
  });

  it("getToken with bodyBytes builds the symmetric pre-image '<base64(bodyBytes)>.<challenge>' (C-CORR-02)", async () => {
    await SecureStore.setItemAsync("prl_attestation_ios_keyId", "KEY_X");
    ExpoAppIntegrity.generateAssertionAsync.mockResolvedValueOnce("A_X");
    const cache = createAttestationCache();
    const port = createIosAttestationPort({
      apiClient: makeMockApiClient() as never,
      cache,
    });

    const bodyBytes = new TextEncoder().encode("hello-world");
    await port.getToken({ bodyBytes });

    const expectedB64 = globalThis.btoa("hello-world");
    expect(ExpoAppIntegrity.generateAssertionAsync).toHaveBeenCalledWith(
      "KEY_X",
      `${expectedB64}.chal-1`,
    );
  });

  it("returns undefined when isSupported=false (simulator / unsupported hardware)", async () => {
    ExpoAppIntegrity.isSupported = false;
    const cache = createAttestationCache();
    const port = createIosAttestationPort({
      apiClient: makeMockApiClient() as never,
      cache,
    });
    await expect(port.getToken()).resolves.toBeUndefined();
  });
});

// ─── Android port ───────────────────────────────────────────────────────────

describe("createAndroidAttestationPort (, C-CORR-03)", () => {
  it("calls prepareIntegrityTokenProviderAsync(cloudProjectNumber) on first use only (RESEARCH Pitfall 3)", async () => {
    ExpoAppIntegrity.prepareIntegrityTokenProviderAsync.mockResolvedValue(
      undefined,
    );
    ExpoAppIntegrity.requestIntegrityCheckAsync.mockResolvedValue("INTEG_TOK");
    const cache = createAttestationCache();
    const port = createAndroidAttestationPort({
      apiClient: makeMockApiClient() as never,
      cache,
      cloudProjectNumber: "12345",
    });

    await port.getToken();
    await port.getToken();
    await port.getToken();

    // prepare exactly once across N getToken invocations.
    expect(
      ExpoAppIntegrity.prepareIntegrityTokenProviderAsync,
    ).toHaveBeenCalledTimes(1);
    expect(
      ExpoAppIntegrity.prepareIntegrityTokenProviderAsync,
    ).toHaveBeenCalledWith("12345");
    expect(ExpoAppIntegrity.requestIntegrityCheckAsync).toHaveBeenCalledTimes(3);
  });

  it("requestIntegrityCheckAsync(requestHash=base64url(SHA256('<base64(body)>.<challenge>'))) — no separate header (C-CORR-03)", async () => {
    ExpoAppIntegrity.prepareIntegrityTokenProviderAsync.mockResolvedValue(
      undefined,
    );
    ExpoAppIntegrity.requestIntegrityCheckAsync.mockResolvedValue("TOK");
    const cache = createAttestationCache();
    const port = createAndroidAttestationPort({
      apiClient: makeMockApiClient() as never,
      cache,
      cloudProjectNumber: "12345",
    });

    await port.getToken({ bodyBytes: new TextEncoder().encode("hello") });

    const callArg =
      ExpoAppIntegrity.requestIntegrityCheckAsync.mock.calls[0]?.[0];
    expect(typeof callArg).toBe("string");
    // base64url alphabet only — no padding, no '+' / '/'.
    expect(callArg).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(callArg).not.toMatch(/=/); // base64url, no padding.
    // SHA-256 → 32 bytes → base64url length = ceil(32/3*4) - padding = 43.
    expect((callArg as string).length).toBe(43);
  });

  it("getToken returns { token, challenge } shape per C-CORR-07", async () => {
    ExpoAppIntegrity.prepareIntegrityTokenProviderAsync.mockResolvedValue(
      undefined,
    );
    ExpoAppIntegrity.requestIntegrityCheckAsync.mockResolvedValue(
      "INTEGRITY_TOKEN_RAW",
    );
    const cache = createAttestationCache();
    // Pre-enroll to take the per-request path.
    await cache.setStatus("enrolled", "android-instance-1");

    const port = createAndroidAttestationPort({
      apiClient: makeMockApiClient() as never,
      cache,
      cloudProjectNumber: "12345",
    });

    const result = await port.getToken();
    expect(result).toEqual({
      token: "android.INTEGRITY_TOKEN_RAW",
      challenge: "chal-1",
    });
  });

  it("getToken NEVER throws — Play Integrity errors return undefined", async () => {
    ExpoAppIntegrity.prepareIntegrityTokenProviderAsync.mockResolvedValue(
      undefined,
    );
    ExpoAppIntegrity.requestIntegrityCheckAsync.mockRejectedValue(
      new Error("Play services unavailable"),
    );
    const cache = createAttestationCache();
    const port = createAndroidAttestationPort({
      apiClient: makeMockApiClient() as never,
      cache,
      cloudProjectNumber: "12345",
    });
    await expect(port.getToken()).resolves.toBeUndefined();
    // Backoff anchor recorded.
    expect(await cache.getStatus()).toBe("failed");
  });

  it("first call enrolls the instance via apiClient.enrollAndroid(integrityToken, challenge)", async () => {
    ExpoAppIntegrity.prepareIntegrityTokenProviderAsync.mockResolvedValue(
      undefined,
    );
    ExpoAppIntegrity.requestIntegrityCheckAsync.mockResolvedValue("INTEG_VR");
    const cache = createAttestationCache();
    const apiClient = makeMockApiClient();
    const port = createAndroidAttestationPort({
      apiClient: apiClient as never,
      cache,
      cloudProjectNumber: "12345",
    });

    await port.getToken();

    expect(apiClient.enrollAndroid).toHaveBeenCalledWith({
      integrityToken: "INTEG_VR",
      challenge: "chal-1",
    });
    expect(await cache.isEnrolled()).toBe(true);
    expect(await cache.getInstanceId()).toBe("android-instance-1");
  });
});

// ─── Cache state machine ────────────────────────────────────────────────────

describe("attestation.cache (, ATTEST-07)", () => {
  it("offline-first launch: status='idle' → tier-0 mode allowed; first online → enroll + status='enrolled'", async () => {
    const cache = createAttestationCache();
    expect(await cache.getStatus()).toBe("idle");
    expect(await cache.isEnrolled()).toBe(false);
    // shouldRetry true for fresh idle (no backoff blocked).
    expect(await cache.shouldRetry()).toBe(true);

    await cache.setStatus("enrolled", "instance-x");
    expect(await cache.isEnrolled()).toBe(true);
    expect(await cache.getInstanceId()).toBe("instance-x");
    expect(await cache.shouldRetry()).toBe(false);
  });

  it("backoff: failed enrollment respects 1m/5m/30m/6h schedule (last_attempt_at anchor)", async () => {
    const cache = createAttestationCache();
    await cache.setStatus("failed");
    // Right after fail: <1m elapsed → no retry.
    expect(await cache.shouldRetry()).toBe(false);

    // Schedule constants locked at module level.
    expect(BACKOFF_MS).toEqual([
      60_000,
      5 * 60_000,
      30 * 60_000,
      6 * 60 * 60_000,
    ]);

    // Time-travel: rewind last_attempt to (1m + 1s) ago → retry allowed.
    await AsyncStorage.setItem(
      "prl_attestation_last_attempt_at",
      String(Date.now() - 61_000),
    );
    expect(await cache.shouldRetry()).toBe(true);
  });

  it("instance_id persisted in AsyncStorage (NOT SecureStore — these values are not secrets, )", async () => {
    const cache = createAttestationCache();
    await cache.setStatus("enrolled", "anon-uuid-abc");

    // AsyncStorage carries the value.
    expect(await AsyncStorage.getItem("prl_attestation_instance_id")).toBe(
      "anon-uuid-abc",
    );
    // SecureStore does NOT carry it.
    expect(
      await SecureStore.getItemAsync("prl_attestation_instance_id"),
    ).toBeNull();
  });
});
