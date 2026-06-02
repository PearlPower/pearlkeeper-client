// apps/mobile/src/services/adapters/createServicePorts.ts
// / / / /
//
// Mobile cutover: getBlockbookClient (direct Blockbook URL) → BackendApiClient
// (backend-proxy via surface).
//
// Two-client construction ( chicken-and-egg defense):
// 1. enrollmentApiClient — no attestationToken; used inside the attestation
// port for `getAttestationChallenge`/`enrollIos`/`enrollAndroid`.
// 2. apiClient (production) — wires networkGate (layer 3) AND
// attestationToken via createMobileAttestationPort.
//
// The shared production apiClient is also installed on the legacy
// `getBlockbookClient` callsite path via setSharedApiClient (Pitfall C-NEW-03)
// so the 7 hook callsites compile unchanged.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";
import {
  BackendApiClient,
  createBackendBlockbookPort,
  createSignedConfigPort,
  createFeeOraclePort,
  createPriceFeedPort,
  // analytics port factory (sourced from api-client
  // post-refactor Change 2 so frontend never imports @prl-wallet/analytics).
  createAnalytics,
} from "@prl-wallet/api-client";
import type { NetworkId, PushRegisterRequest } from "@prl-wallet/api-schemas";
import { BLOCKCHAINS } from "@prl-wallet/config";
import { setSharedApiClient } from "../blockbookClient";
import { createMobileAttestationPort } from "../attestation";
import { createAttestationCache } from "../attestation.cache";
import { EXPO_PUBLIC_BACKEND_BASE_URL } from "../../config/env";
import {
  deletePinHash,
  deleteWalletSecrets,
  getBIP32Seed,
  getMnemonic,
  getPinHash,
  getWalletType,
  getXpub,
  storeBIP32Seed,
  storeMnemonic,
  storePinHash,
  storeWalletType,
  storeXpub,
} from "../secureStorage";
import { useWalletListStore } from "../../store/walletListStore";
import type {
  BlockbookPort,
  ServicesPorts,
  WalletRecord,
} from "@prl-wallet/services";
import type { NetworkGatePort } from "@prl-wallet/app-adapters";

function createId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  return `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createServicePorts(opts?: {
  networkGate?: NetworkGatePort;
}): ServicesPorts {
  // enrollment-only client (no attestationToken). Used by
  // the attestation port for `enrollIos`/`enrollAndroid`/`getAttestationChallenge`
  // calls, which MUST NOT carry attestation headers (the device is enrolling
  // itself; it has no token to send yet).
  const enrollmentApiClient = new BackendApiClient(
    EXPO_PUBLIC_BACKEND_BASE_URL,
    {
      networkGate: opts?.networkGate,
    },
  );

  // mobile attestation port — Platform.OS-aware dispatcher.
  const attestationToken = createMobileAttestationPort({
    apiClient: enrollmentApiClient,
    cache: createAttestationCache(),
    androidCloudProjectNumber:
      process.env.EXPO_PUBLIC_ANDROID_CLOUD_PROJECT_NUMBER,
  });

  // one shared production BackendApiClient per
  // createServicePorts() call. Wires networkGate (layer 3
  // short-circuit) + attestationToken. Default timeoutMs of 10_000
  // () carries mobile-broadcast-timeout fix.
  const apiClient = new BackendApiClient(EXPO_PUBLIC_BACKEND_BASE_URL, {
    networkGate: opts?.networkGate,
    attestationToken,
  });

  // Pitfall C-NEW-03 — install the shared client for the hook-callsite path
  // (apps/mobile/src/services/blockbookClient.ts). Hook screens compile
  // unchanged because getBlockbookClient now returns the façade backed by
  // this same instance.
  setSharedApiClient(apiClient);

  function createBlockbookPort(networkId: string): BlockbookPort {
    return createBackendBlockbookPort(networkId as NetworkId, apiClient);
  }

  // .. — SignedConfigPort wiring. Mobile uses the
  // AsyncStorage-backed StoragePort + the bundled blockchains.json as
  // chain-config fallback. The port is OPTIONAL on `ServicesPorts` in
  // (no consumer code reads from it yet); .1
  // chain-config cutover wires the first consumers via
  // useSignedConfig("chain-config").
  //
  // feeOracle + priceFeed share the same AsyncStorage-
  // backed StoragePort. Defining `sharedStoragePort` once keeps the three
  // factory calls aligned (DRY: one StoragePort instance, three adapter
  // factories).
  const sharedStoragePort = {
    getItem: (k: string) => AsyncStorage.getItem(k),
    setItem: (k: string, v: string) => AsyncStorage.setItem(k, v),
    removeItem: (k: string) => AsyncStorage.removeItem(k),
  };

  const signedConfigPort = createSignedConfigPort({
    client: apiClient,
    storage: sharedStoragePort,
    bundledChainConfig: { blockchains: BLOCKCHAINS },
  });

  // feeOraclePort + priceFeedPort. NEVER-rejecting
  // adapters with LKG StoragePort caching (per-network cache key for
  // fees, single global cache key for prices). Hook layer
  // (useFeeOracle / usePrice) reads from these via
  // useAdapters().services.{feeOracle|priceFeed}.
  const feeOraclePort = createFeeOraclePort({
    client: apiClient,
    storage: sharedStoragePort,
  });
  const priceFeedPort = createPriceFeedPort({
    client: apiClient,
    storage: sharedStoragePort,
  });

  // expose the three BackendApiClient push methods on
  // ServicesPorts.push so <PushListenersSetup /> ( token-rotation
  // listener) and <NotificationsScreen /> (.. settings UI) can
  // invoke them via useAdapters().services.push without piercing the
  // BackendApiClient construction abstraction. Bound thin wrappers keep
  // `this` correct on the apiClient instance.
  const pushPort = {
    registerPush: (req: PushRegisterRequest) => apiClient.registerPush(req),
    unregisterPush: () => apiClient.unregisterPush(),
    getPushPrefs: () => apiClient.getPushPrefs(),
  };

  // + + — opt-in analytics port. Tier-0 acceptable
  // (no requireAttestationLevel gate; ). Reads consent state from the
  // mobile walletListStore singleton (Zustand persist over AsyncStorage).
  // appVersion: expo-application returns null on Expo Go (RESEARCH §"Pitfall
  // 7"); the "0.0.0" fallback ensures the closed-schema regex /^\d+\.\d+\.\d+/
  // passes during dev sessions.
  const analyticsPlatform: "ios" | "android" =
    Platform.OS === "android" ? "android" : "ios";
  const analyticsPort = createAnalytics({
    apiClient: {
      postAnalyticsEvents: (events) => apiClient.postAnalyticsEvents(events),
    },
    consentReader: () => useWalletListStore.getState().analyticsConsent.granted,
    consentSnapshot: () => useWalletListStore.getState().analyticsConsent,
    consentSetter: (next) =>
      useWalletListStore.getState().setAnalyticsConsent(next),
    platform: analyticsPlatform,
    appVersionReader: () => Application.nativeApplicationVersion ?? "0.0.0",
    backendBaseUrl: EXPO_PUBLIC_BACKEND_BASE_URL,
  });

  return {
    secrets: {
      getMnemonic,
      getBIP32Seed,
      getXpub,
      getWalletType,
      storeMnemonic,
      storeBIP32Seed,
      storeXpub,
      storeWalletType,
      deleteWalletSecrets,
      getPinHash,
      storePinHash,
      deletePinHash,
    },
    registry: {
      async listWallets(): Promise<WalletRecord[]> {
        return useWalletListStore.getState().wallets;
      },
      async getWallet(walletId: string): Promise<WalletRecord | null> {
        return (
          useWalletListStore
            .getState()
            .wallets.find((wallet) => wallet.id === walletId) ?? null
        );
      },
      async getActiveWalletId(): Promise<string | null> {
        return useWalletListStore.getState().activeWalletId;
      },
      async addWallet(record: WalletRecord): Promise<void> {
        useWalletListStore.getState().addWallet(record);
      },
      async removeWallet(walletId: string): Promise<void> {
        useWalletListStore.getState().removeWallet(walletId);
      },
      async setActiveWalletId(walletId: string | null): Promise<void> {
        useWalletListStore.getState().setActiveWalletId(walletId);
      },
      async updateWalletBalance(
        walletId: string,
        balance: string,
      ): Promise<void> {
        useWalletListStore.getState().updateWalletBalance(walletId, balance);
      },
    },
    blockbook: createBlockbookPort,
    runtime: {
      now: () => Date.now(),
      createId,
    },
    networkGate: opts?.networkGate,
    signedConfig: signedConfigPort,
    // wired ports for fee oracle + price feed.
    feeOracle: feeOraclePort,
    priceFeed: priceFeedPort,
    // wired push port for NotificationsScreen +
    // PushListenersSetup token-rotation listener.
    push: pushPort,
    // wired analytics port (mobile parity with desktop;
    // see also apps/desktop/src/platform/createServicePorts.ts).
    analytics: analyticsPort,
    // Unified release-update mechanism — fetches the changelog markdown
    // shown in the UpdateBanner. Bound thin wrapper keeps `this` correct
    // on the apiClient instance.
    releases: {
      getReleasesSince: (v: string) => apiClient.getReleasesSince(v),
    },
  };
}
