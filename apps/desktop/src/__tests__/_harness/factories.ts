// apps/desktop/src/__tests__/_harness/factories.ts
//
// Task 3 — generic AdaptersBundle factory + Wallet seeder
// for every Wave 2/3 desktop screen test.
//
// Extracted verbatim from the make* helpers in hydrationGate.test.tsx and
// statusBar.test.tsx so per-screen tests stop duplicating the in-memory
// adapter wiring (PATTERNS.md §"apps/desktop/src/__tests__/testHarness.tsx").
//
// T-20-02 mitigation: every call to buildTestBundle() constructs FRESH
// Map-backed in-memory ports + fresh store factories — no module-level state
// carries between tests. The single module-level `walletCounter` only
// generates unique IDs/names for seedWallet; the Wallet objects it returns
// are otherwise independent.
//
// W-11: seedWallet returns a fully-typed WalletRecord so Plans 07/08 can
// drop their `as never` casts. If WalletRecord ever grows new required
// fields, the `defaults: WalletRecord` annotation will fail to compile
// here — forcing this factory to update in lockstep with the type.

import {
  type AdaptersBundle,
  type StoragePort,
  type ClipboardPort,
  type SharingPort,
  type ClockPort,
  type NetworkGatePort,
} from "@prl-wallet/app-adapters";
import {
  createWalletListStore,
  createPinStore,
  createLockStore,
  createNetworkGateStore,
  type WalletRecord,
} from "@prl-wallet/app-state";
import type { WalletSecretsPort } from "@prl-wallet/services";
import { createServicePorts } from "../../platform/createServicePorts";
import { clipboardStub } from "../../platform/stubs/clipboard";
import { sharingStub } from "../../platform/stubs/sharing";
import { clockStub } from "../../platform/stubs/clock";

export function makeFakeStoragePort(): StoragePort {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      map.set(k, v);
    },
    removeItem: async (k) => {
      map.delete(k);
    },
  };
}

export function makeFakeSecrets(): WalletSecretsPort {
  return {
    getMnemonic: async () => null,
    getBIP32Seed: async () => null,
    getXpub: async () => null,
    getWalletType: async () => null,
    storeMnemonic: async () => {},
    storeBIP32Seed: async () => {},
    storeXpub: async () => {},
    storeWalletType: async () => {},
    deleteWalletSecrets: async () => {},
    getPinHash: async () => null,
    storePinHash: async () => {},
    deletePinHash: async () => {},
  };
}

export interface BuildTestBundleOptions {
  /** Default: true — Pitfall 8 says screens that issue gated queries need
   * the gate OPEN before render or queries hang on the closed gate. */
  networkGateOpen?: boolean;
}

export function buildTestBundle(
  opts: BuildTestBundleOptions = {},
): AdaptersBundle {
  const storage = makeFakeStoragePort();
  const secrets = makeFakeSecrets();
  const walletList = createWalletListStore(storage);
  const pin = createPinStore();
  // : createLockStore now accepts StoragePort for persisted idleTimeoutMs.
  const lock = createLockStore(makeFakeStoragePort());
  // Each bundle gets its own StoragePort for the network gate — keeps the
  // gate's persisted state isolated from walletList persistence.
  const networkGate = createNetworkGateStore(makeFakeStoragePort());

  // Default OPEN unless caller opts out (Pitfall 8). The factory store's
  // first-launch default is `false` (), so we must explicitly
  // open the gate for Wave 2/3 screen tests that depend on TanStack Query
  // resolving fetches synchronously through the stub adapters.
  const wantOpen = opts.networkGateOpen ?? true;
  if (wantOpen) {
    networkGate.getState().open();
  }

  const networkGatePort: NetworkGatePort = {
    isOpen: () => networkGate.getState().isOpen,
    subscribe: (listener) =>
      networkGate.subscribe((state, prevState) => {
        if (state.isOpen !== prevState.isOpen) listener(state.isOpen);
      }),
  };

  return {
    ports: {
      clipboard: clipboardStub satisfies ClipboardPort,
      sharing: sharingStub satisfies SharingPort,
      storage,
      networkGate: networkGatePort,
      clock: clockStub satisfies ClockPort,
    },
    services: createServicePorts({
      secrets,
      walletListStore: walletList,
      networkGate: networkGatePort,
      // Wave 2/3 tests stub blockbook responses through TanStack Query mocks
      // or by setting wallet metadata directly — no real fetch should fire.
      fetchImpl: async () => {
        throw new Error(
          "blockbook fetch is not stubbed in test harness — set wallet state explicitly or mock the query",
        );
      },
    }),
    stores: { walletList, pin, lock, networkGate },
  };
}

// Module-level counter for unique IDs/names — does NOT carry test state
// across boundaries because every WalletRecord returned is a fresh object
// with deterministic-but-distinct identity (T-20-02 stays satisfied).
//
// IN-10 — WARNING for callers: the auto-generated `id` and `name` are
// guaranteed UNIQUE within a test worker but are NOT stable across test
// re-orderings. Two consequences:
// Do NOT assert on the auto-generated values, e.g.
// `expect(wallet.id).toBe("test-wallet-3")` is flaky — it only passes
// when this seedWallet() call happens to be the third in the worker.
// If your test depends on a specific id/name, set it explicitly via
// overrides: `seedWallet({ id: "my-wallet", name: "Mine" })`.
// Object identity, equality of fields you set explicitly, and counter
// uniqueness within a test ARE all stable.
let walletCounter = 0;

/**
 * IN-10 — test-only escape hatch to reset the module-level walletCounter.
 * Exported so a future global vitest setup hook can call it from
 * `beforeEach` to make auto-generated wallet IDs deterministic per test
 * if a future test ever needs to assert on them. Today no test does, so
 * this remains opt-in rather than wired into a setup file.
 */
export function __resetWalletCounter(): void {
  walletCounter = 0;
}

/**
 * W-11: type-safe Wallet factory for tests. Plans 07/08 import this instead
 * of constructing wallets with `as never` casts. If WalletRecord grows new
 * required fields, the `defaults: WalletRecord` annotation forces this
 * factory to update — TS will reject any missing field at compile time.
 */
export function seedWallet(
  overrides: Partial<WalletRecord> = {},
): WalletRecord {
  walletCounter += 1;
  const defaults: WalletRecord = {
    id: `test-wallet-${walletCounter}`,
    name: `Test Wallet ${walletCounter}`,
    networkId: "btc-testnet",
    createdAt: 1700000000000,
    // lastKnownBalance and nextReceiveAddress are optional in WalletRecord
    // so they are not required in defaults; tests that need them set via
    // overrides.
  };
  return { ...defaults, ...overrides };
}
