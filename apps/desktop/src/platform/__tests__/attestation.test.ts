// apps/desktop/src/platform/__tests__/attestation.test.ts
// fulfills the 6 Wave-0 RED stubs from .
//
// Test isolation: vi.mock("@tauri-apps/api/core") and vi.mock(
// "@tauri-apps/plugin-store") replace the runtime invokers with vitest mocks
// so the suite runs under jsdom without a Tauri runtime. The plugin-store
// mock returns a per-test in-memory Store-shaped object so cache-state
// assertions (status / instanceId) can read what the previous step wrote.
//
// Pattern source: apps/desktop/src/platform/__tests__/storage.contract.test.ts
// (vitest + vi.mock for @tauri-apps/api/core analog).

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { createDesktopAttestationPort } from "../attestation";

const mockedInvoke = invoke as unknown as Mock;
const mockedLoad = load as unknown as Mock;

interface MockStore {
  data: Map<string, unknown>;
  get: Mock;
  set: Mock;
  save: Mock;
}

function makeMockStore(initial: Record<string, unknown> = {}): MockStore {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    data,
    get: vi.fn(async (k: string) => data.get(k)),
    set: vi.fn(async (k: string, v: unknown) => {
      data.set(k, v);
    }),
    save: vi.fn(async () => {}),
  };
}

interface MockApiClient {
  getAttestationChallenge: Mock;
  enrollDesktop: Mock;
}

function makeMockApiClient(): MockApiClient {
  return {
    getAttestationChallenge: vi.fn(),
    enrollDesktop: vi.fn(),
  };
}

interface MockNetworkGate {
  isOpen: Mock;
  subscribe: Mock;
}

function makeMockNetworkGate(open: boolean): MockNetworkGate {
  // The port () reads `isOpen()` only. `subscribe` is part of the
  // NetworkGatePort surface but unused here — we still mock it to satisfy
  // the structural type check.
  return {
    isOpen: vi.fn(() => open),
    subscribe: vi.fn(() => () => {
      /* unsubscribe noop */
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDesktopAttestationPort (, , C-CORR-07)", () => {
  it("getToken returns undefined while NetworkGate is closed (, ATTEST-07)", async () => {
    // Gate closed → no plugin-store read, no invoke call, undefined return.
    // Verifies that the offline-gate check is the FIRST branch (not after
    // plugin-store I/O or a Tauri invoke).
    const store = makeMockStore();
    mockedLoad.mockResolvedValue(store);
    const apiClient = makeMockApiClient();
    const networkGate = makeMockNetworkGate(false);

    const port = createDesktopAttestationPort({
      apiClient: apiClient as unknown as Parameters<
        typeof createDesktopAttestationPort
      >[0]["apiClient"],
      networkGate,
    });

    const result = await port.getToken();
    expect(result).toBeUndefined();
    expect(networkGate.isOpen).toHaveBeenCalled();
    expect(mockedInvoke).not.toHaveBeenCalled();
    expect(apiClient.getAttestationChallenge).not.toHaveBeenCalled();
    expect(apiClient.enrollDesktop).not.toHaveBeenCalled();
  });

  it("first call: invoke('attestation_enroll', { challenge }) → enrollDesktop → cache instance_id in tauri-plugin-store", async () => {
    // Cache starts empty (status === undefined); the port should:
    // 1. fetch a challenge,
    // 2. invoke('attestation_enroll', { challenge }),
    // 3. POST to backend enrollDesktop,
    // 4. write { instanceId, status:"enrolled" } to plugin-store,
    // 5. save the store, and return undefined (first call kicks off
    // enrollment but doesn't carry a token).
    const store = makeMockStore();
    mockedLoad.mockResolvedValue(store);
    const apiClient = makeMockApiClient();
    apiClient.getAttestationChallenge.mockResolvedValue({
      challenge: "ch-xyz",
      expiresAt: 1_700_000_000_000,
    });
    apiClient.enrollDesktop.mockResolvedValue({
      instanceId: "abc-instance-id",
      attestationLevel: 1,
    });
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "attestation_enroll") {
        return {
          public_key: "PUBKEY_BASE64",
          signature: "SIG_BASE64",
          instance_id: "abc-instance-id",
        };
      }
      throw new Error(`unexpected invoke ${cmd}`);
    });
    const networkGate = makeMockNetworkGate(true);

    const port = createDesktopAttestationPort({
      apiClient: apiClient as unknown as Parameters<
        typeof createDesktopAttestationPort
      >[0]["apiClient"],
      networkGate,
    });

    const result = await port.getToken();

    // First call returns undefined (no token attached on the enrollment-trigger request).
    expect(result).toBeUndefined();

    // Verify the full enrollment flow ran in order.
    expect(apiClient.getAttestationChallenge).toHaveBeenCalledTimes(1);
    expect(mockedInvoke).toHaveBeenCalledWith("attestation_enroll", {
      challenge: "ch-xyz",
    });
    expect(apiClient.enrollDesktop).toHaveBeenCalledWith({
      publicKey: "PUBKEY_BASE64",
      signature: "SIG_BASE64",
      challenge: "ch-xyz",
    });

    // Cache now contains the enrolled state.
    expect(store.data.get("attestation.instanceId")).toBe("abc-instance-id");
    expect(store.data.get("attestation.status")).toBe("enrolled");
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("per-request: invoke('attestation_sign', { challenge, bodyHash }) → desktop.<instance_id>.<signature>", async () => {
    // Cache pre-populated with enrolled state. Per-request flow:
    // 1. fetch fresh challenge,
    // 2. invoke('attestation_sign', { challenge, bodyHash: base64(body) + "." }),
    // 3. return { token: "desktop.<id>.<sig-base64url>", challenge }.
    const store = makeMockStore({
      "attestation.instanceId": "abc",
      "attestation.status": "enrolled",
    });
    mockedLoad.mockResolvedValue(store);
    const apiClient = makeMockApiClient();
    apiClient.getAttestationChallenge.mockResolvedValue({
      challenge: "fresh-ch-1",
      expiresAt: 1_700_000_000_000,
    });
    // Rust returns standard-base64 sig; the port converts to base64url for the wire token.
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "attestation_sign") {
        return "AAAA+/+="; // standard base64; URL-unsafe chars exercise the toBase64Url helper.
      }
      throw new Error(`unexpected invoke ${cmd}`);
    });
    const networkGate = makeMockNetworkGate(true);

    const port = createDesktopAttestationPort({
      apiClient: apiClient as unknown as Parameters<
        typeof createDesktopAttestationPort
      >[0]["apiClient"],
      networkGate,
    });

    const bodyBytes = new TextEncoder().encode(`{"hello":"world"}`);
    const result = await port.getToken({ bodyBytes });

    // Token is desktop.<id>.<sig-base64url> — toBase64Url should drop padding
    // and replace + → -, / → _ (here AAAA+/+= → AAAA-_).
    expect(result?.token).toBe("desktop.abc.AAAA-_-");
    expect(result?.challenge).toBe("fresh-ch-1");

    // Verify the bodyHash arg ended in a literal "." separator and the
    // base64 encoding was the correct base64 of the body bytes.
    // (Tauri 2.x auto-converts JS-side parameter names to camelCase before
    // matching against Rust function args — DI-29-UAT-05.)
    const bodyB64 = globalThis.btoa(
      String.fromCharCode(...Array.from(bodyBytes)),
    );
    expect(mockedInvoke).toHaveBeenCalledWith("attestation_sign", {
      challenge: "fresh-ch-1",
      bodyHash: `${bodyB64}.`,
    });

    // Per-request flow does NOT re-invoke attestation_enroll.
    const enrollCalls = mockedInvoke.mock.calls.filter(
      (c) => c[0] === "attestation_enroll",
    );
    expect(enrollCalls).toHaveLength(0);
    expect(apiClient.enrollDesktop).not.toHaveBeenCalled();
  });

  it("getToken returns { token, challenge } shape per C-CORR-07 (single port call attaches both headers)", async () => {
    // The return shape is the load-bearing C-CORR-07 invariant: a single port
    // invocation hands back BOTH the wire token AND the challenge that was
    // signed against, so BackendApiClient.fetchWithTimeout can attach
    // x-attestation-token AND x-attestation-challenge atomically (or NEITHER
    // on undefined). This test pins the shape (object with two string fields,
    // not a bare string).
    const store = makeMockStore({
      "attestation.instanceId": "id-2",
      "attestation.status": "enrolled",
    });
    mockedLoad.mockResolvedValue(store);
    const apiClient = makeMockApiClient();
    apiClient.getAttestationChallenge.mockResolvedValue({
      challenge: "challenge-shape-test",
      expiresAt: 1_700_000_000_000,
    });
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "attestation_sign") return "sig-base64-payload==";
      throw new Error(`unexpected invoke ${cmd}`);
    });
    const networkGate = makeMockNetworkGate(true);

    const port = createDesktopAttestationPort({
      apiClient: apiClient as unknown as Parameters<
        typeof createDesktopAttestationPort
      >[0]["apiClient"],
      networkGate,
    });

    const result = await port.getToken();
    // Object shape (not a bare string) with both required fields.
    expect(result).toBeDefined();
    expect(typeof result?.token).toBe("string");
    expect(typeof result?.challenge).toBe("string");
    expect(result?.token.length).toBeGreaterThan(0);
    expect(result?.challenge.length).toBeGreaterThan(0);

    // The challenge in the return is exactly the one fetched.
    expect(result?.challenge).toBe("challenge-shape-test");
    // The token follows the desktop.<id>.<sig-base64url> wire format.
    expect(result?.token.startsWith("desktop.id-2.")).toBe(true);
  });

  it("getToken NEVER throws — Tauri invoke error path returns undefined", async () => {
    // The port MUST swallow ALL failures and map them to undefined so
    // BackendApiClient.fetchWithTimeout sees "no token" and proceeds tier-0.
    // Throwing would break the calling fetch — so we assert no throw, only
    // an undefined return.
    const store = makeMockStore({
      "attestation.instanceId": "id-3",
      "attestation.status": "enrolled",
    });
    mockedLoad.mockResolvedValue(store);
    const apiClient = makeMockApiClient();
    apiClient.getAttestationChallenge.mockResolvedValue({
      challenge: "ch",
      expiresAt: 1_700_000_000_000,
    });
    // Rust command throws (e.g., keychain unavailable). Should NOT propagate.
    mockedInvoke.mockImplementation(async () => {
      throw new Error("KeychainUnavailable");
    });
    const networkGate = makeMockNetworkGate(true);

    const port = createDesktopAttestationPort({
      apiClient: apiClient as unknown as Parameters<
        typeof createDesktopAttestationPort
      >[0]["apiClient"],
      networkGate,
    });

    const result = await port.getToken();
    expect(result).toBeUndefined();

    // Also verify enrollment-path errors are swallowed: with empty cache and
    // an enrollDesktop rejection, the port must still return undefined.
    const store2 = makeMockStore();
    mockedLoad.mockResolvedValue(store2);
    apiClient.enrollDesktop.mockRejectedValue(new Error("backend 500"));
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "attestation_enroll") {
        return {
          public_key: "p",
          signature: "s",
          instance_id: "i",
        };
      }
      throw new Error(`unexpected invoke ${cmd}`);
    });

    const port2 = createDesktopAttestationPort({
      apiClient: apiClient as unknown as Parameters<
        typeof createDesktopAttestationPort
      >[0]["apiClient"],
      networkGate,
    });
    const r2 = await port2.getToken();
    expect(r2).toBeUndefined();
  });

  it("idempotent enrollment — second call returns cached instance_id without re-invoking attestation_enroll", async () => {
    // After successful enrollment, the cache is read on subsequent calls
    // and the per-request signing path runs (NOT the enrollment branch).
    // This test pre-populates the enrolled state and verifies attestation_enroll
    // is never called.
    const store = makeMockStore({
      "attestation.instanceId": "cached-id",
      "attestation.status": "enrolled",
    });
    mockedLoad.mockResolvedValue(store);
    const apiClient = makeMockApiClient();
    apiClient.getAttestationChallenge.mockResolvedValue({
      challenge: "ch-second",
      expiresAt: 1_700_000_000_000,
    });
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "attestation_sign") return "sig==";
      if (cmd === "attestation_enroll") {
        throw new Error(
          "attestation_enroll MUST NOT be called when cache is already enrolled",
        );
      }
      throw new Error(`unexpected invoke ${cmd}`);
    });
    const networkGate = makeMockNetworkGate(true);

    const port = createDesktopAttestationPort({
      apiClient: apiClient as unknown as Parameters<
        typeof createDesktopAttestationPort
      >[0]["apiClient"],
      networkGate,
    });

    const r1 = await port.getToken();
    const r2 = await port.getToken();

    expect(r1?.token.startsWith("desktop.cached-id.")).toBe(true);
    expect(r2?.token.startsWith("desktop.cached-id.")).toBe(true);

    // attestation_enroll MUST NOT have been called on either invocation.
    const enrollCalls = mockedInvoke.mock.calls.filter(
      (c) => c[0] === "attestation_enroll",
    );
    expect(enrollCalls).toHaveLength(0);

    // enrollDesktop on the BackendApiClient also MUST NOT have been called.
    expect(apiClient.enrollDesktop).not.toHaveBeenCalled();

    // Each per-request call fetches a fresh challenge.
    expect(apiClient.getAttestationChallenge).toHaveBeenCalledTimes(2);
  });
});
