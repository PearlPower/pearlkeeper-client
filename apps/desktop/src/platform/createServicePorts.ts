// apps/desktop/src/platform/createServicePorts.ts
//
// / / /
//
// Cutover from the per-networkId BlockbookClient cache to a single
// shared BackendApiClient per createServicePorts() call. The blockbookClients
// Map is deleted; the factory is now structurally identical to mobile
// () modulo the explicit DI surface (deps).
//
// Threat model:
// The single shared apiClient instance carries networkGate
// (layer 3 short-circuit) and attestation port wiring; every
// call through ports.blockbook(networkId) uses these wirings via
// createBackendBlockbookPort.
// The hook-callsite path (Pitfall C-NEW-11 — WalletDetailScreen calls
// getBlockbookClient directly) flows through the SAME apiClient via
// setSharedApiClient — no privilege gap, no second transport.
//
// Attestation port wiring ():
// createDesktopAttestationPort takes { apiClient, networkGate } where the
// apiClient is used for the tier-0 enrollment routes (getAttestationChallenge
// + enrollDesktop, both flagged skipAttestation in BackendApiClient so they
// bypass the very port we're constructing — chicken-and-egg defense).
// We construct an enrollment-only client (no attestationToken) for the
// port, then construct the production apiClient with the port wired in.

import {
  BackendApiClient,
  createBackendBlockbookPort,
  createSignedConfigPort,
  createFeeOraclePort,
  createPriceFeedPort,
  // analytics port factory (sourced from api-client
  // post-refactor Change 2 so frontend never imports @prl-wallet/analytics).
  createAnalytics,
  type StoragePortLike,
} from "@prl-wallet/api-client";
import type { NetworkId } from "@prl-wallet/api-schemas";
import { BLOCKCHAINS } from "@prl-wallet/config";
// / RESEARCH §"Pitfall 8" — Tauri getVersion() lives at the
// `/app` subpath, NOT the package root. Async by design (reads
// tauri.conf.json `version` field at build time).
import { getVersion } from "@tauri-apps/api/app";
import type {
  BlockbookPort,
  ServicesPorts,
  WalletRecord,
  WalletSecretsPort,
} from "@prl-wallet/services";
import type { NetworkGatePort } from "@prl-wallet/app-adapters";
import type { WalletListStore } from "@prl-wallet/app-state";
import { setSharedApiClient } from "../lib/getBlockbookClient";
import { createDesktopAttestationPort } from "./attestation";
import { scopedFetch } from "./scopedFetch";
import { VITE_BACKEND_BASE_URL } from "../lib/env";

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: construct a UUID-v4 from getRandomValues (CSPRNG, always
  // available because assertSecureRandom() has already passed at boot).
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant bits
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export interface DesktopServicePortsDeps {
  secrets: WalletSecretsPort;
  walletListStore: WalletListStore;
  networkGate?: NetworkGatePort;
  // eslint-disable-next-line no-restricted-globals -- type-only reference; runtime fetch is owned by scopedFetch.ts
  fetchImpl?: typeof fetch;
  /**
   * StoragePort instance for the SignedConfigPort
   * adapter (last-known-good cache + monotonic version state).
   * Production wiring (apps/desktop/src/main.tsx) passes the
   * tauri-plugin-store-backed StoragePort from `./storage.ts`. Tests
   * may pass an in-memory fake or omit (signedConfig wiring is
   * skipped if undefined — 's hook is registered-but-unused
   * per , so test factories that don't exercise signed-config can
   * leave this undefined).
   */
  storage?: StoragePortLike;
}

export function createServicePorts(
  deps: DesktopServicePortsDeps,
): ServicesPorts {
  // : one shared BackendApiClient per createServicePorts() call.
  //
  // Two-step construction to satisfy the chicken-and-egg between the
  // attestation port (which needs an apiClient to call enrollment routes)
  // and the production apiClient (which needs the attestation port to
  // attach x-attestation-token headers per ).
  //
  // Step 1: enrollment-only client (no attestationToken) — the desktop
  // attestation port uses this for getAttestationChallenge +
  // enrollDesktop, both flagged skipAttestation in BackendApiClient.
  // Step 2: production apiClient with the port wired in.
  //
  // The networkGate flows to BOTH clients so closed-gate also short-circuits
  // enrollment ( layer 3 + ATTEST-07 — offline-first
  // launch does not block enrollment; the next call after gate-open kicks
  // it off).
  const enrollmentClient = new BackendApiClient(VITE_BACKEND_BASE_URL, {
    fetchImpl: deps.fetchImpl ?? scopedFetch,
    networkGate: deps.networkGate,
  });

  // + ATTEST-07: createDesktopAttestationPort requires a
  // NetworkGatePort. When deps.networkGate is undefined (test path), use a
  // permissive stub so the port construction doesn't NPE — production
  // wiring (apps/desktop/src/main.tsx) ALWAYS passes a real gate.
  const networkGateForAttestation: NetworkGatePort = deps.networkGate ?? {
    isOpen: () => true,
    subscribe: () => () => {
      /* noop */
    },
  };

  const apiClient = new BackendApiClient(VITE_BACKEND_BASE_URL, {
    fetchImpl: deps.fetchImpl ?? scopedFetch,
    networkGate: deps.networkGate,
    attestationToken: createDesktopAttestationPort({
      apiClient: enrollmentClient,
      networkGate: networkGateForAttestation,
    }),
  });

  // Pitfall C-NEW-03 + C-NEW-11 — install the shared client so the
  // hook-callsite path (getBlockbookClient in apps/desktop/src/lib) returns
  // a façade backed by the SAME apiClient as ports.blockbook(networkId).
  setSharedApiClient(apiClient);

  function createBlockbookPort(networkId: string): BlockbookPort {
    return createBackendBlockbookPort(networkId as NetworkId, apiClient);
  }

  // .. — SignedConfigPort wiring. Desktop uses the
  // tauri-plugin-store-backed StoragePort (passed via deps.storage) +
  // the bundled blockchains.json as chain-config fallback. The port is
  // OPTIONAL on `ServicesPorts` in (no consumer code reads
  // from it yet); becomes a required hard dep when .1
  // chain-config cutover wires the first consumers via
  // useSignedConfig("chain-config"). Test factories that omit
  // deps.storage produce a port-less ServicesPorts — useSignedConfig
  // callers must check for undefined.
  const signedConfigPort = deps.storage
    ? createSignedConfigPort({
        client: apiClient,
        storage: deps.storage,
        bundledChainConfig: { blockchains: BLOCKCHAINS },
      })
    : undefined;

  // feeOracle + priceFeed ports. Optional via
  // deps.storage (mirrors pattern). Production wiring
  // (apps/desktop/src/main.tsx) ALWAYS passes a real StoragePort; test
  // factories that don't exercise fee/price can omit `deps.storage`
  // and the ports remain undefined (the hook layer tolerates this and
  // returns the unavailable shape).
  const feeOraclePort = deps.storage
    ? createFeeOraclePort({
        client: apiClient,
        storage: deps.storage,
      })
    : undefined;
  const priceFeedPort = deps.storage
    ? createPriceFeedPort({
        client: apiClient,
        storage: deps.storage,
      })
    : undefined;

  // opt-in analytics port (full feature parity with mobile
  // per UI-SPEC §10). Tauri getVersion() is async (RESEARCH §"Pitfall 8"); use
  // the cached-promise pattern (RESEARCH lines 1037-1052): fire the read
  // once, store the resolved value into a closed-over slot, and fall back to
  // "0.0.0" until the cache fills. The first analytics event is always
  // `consent.granted` fired from the AnalyticsScreen handler — by the time
  // the user mounts that screen, the cache is filled (multiple render
  // cycles ago).
  let cachedAppVersion: string | null = null;
  void getVersion()
    .then((v) => {
      cachedAppVersion = v;
    })
    .catch(() => {
      // Tauri returning a version reject is unrecoverable for this
      // purpose; the "0.0.0" fallback persists for the session.
    });
  const analyticsPort = createAnalytics({
    apiClient: {
      postAnalyticsEvents: (events) => apiClient.postAnalyticsEvents(events),
    },
    consentReader: () =>
      deps.walletListStore.getState().analyticsConsent.granted,
    consentSnapshot: () => deps.walletListStore.getState().analyticsConsent,
    consentSetter: (next) =>
      deps.walletListStore.getState().setAnalyticsConsent(next),
    platform: "desktop",
    appVersionReader: () => cachedAppVersion ?? "0.0.0",
    backendBaseUrl: VITE_BACKEND_BASE_URL,
  });

  return {
    secrets: deps.secrets,
    registry: {
      async listWallets(): Promise<WalletRecord[]> {
        return deps.walletListStore.getState().wallets;
      },
      async getWallet(walletId: string): Promise<WalletRecord | null> {
        return (
          deps.walletListStore
            .getState()
            .wallets.find((w) => w.id === walletId) ?? null
        );
      },
      async getActiveWalletId(): Promise<string | null> {
        return deps.walletListStore.getState().activeWalletId;
      },
      async addWallet(record: WalletRecord): Promise<void> {
        deps.walletListStore.getState().addWallet(record);
      },
      async removeWallet(walletId: string): Promise<void> {
        deps.walletListStore.getState().removeWallet(walletId);
      },
      async setActiveWalletId(walletId: string | null): Promise<void> {
        deps.walletListStore.getState().setActiveWalletId(walletId);
      },
      async updateWalletBalance(
        walletId: string,
        balance: string,
      ): Promise<void> {
        deps.walletListStore.getState().updateWalletBalance(walletId, balance);
      },
    },
    blockbook: createBlockbookPort,
    runtime: { now: () => Date.now(), createId },
    networkGate: deps.networkGate,
    signedConfig: signedConfigPort,
    // feeOracle + priceFeed ports (undefined when
    // deps.storage is absent — test-factory pattern).
    feeOracle: feeOraclePort,
    priceFeed: priceFeedPort,
    // wired analytics port (full feature parity with
    // mobile; see also apps/mobile/src/services/adapters/createServicePorts.ts).
    analytics: analyticsPort,
    // Unified release-update mechanism — fetches the markdown changelog
    // shown in the on-startup UpdateBanner. Bound thin wrapper preserves
    // `this` on the apiClient instance.
    releases: {
      getReleasesSince: (v: string) => apiClient.getReleasesSince(v),
    },
  };
}
