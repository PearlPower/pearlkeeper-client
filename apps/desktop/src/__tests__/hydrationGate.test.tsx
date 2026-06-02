// apps/desktop/src/__tests__/hydrationGate.test.tsx
//
// Wave 3 — hydration race regression test.
// Mounts <HydrationGate> against a real AdaptersBundle wired from the
// in-memory StoragePort + factory stores so the gate's useStore selectors
// observe genuine flag flips. useBootstrapSecurity is mocked to a no-op so
// only the explicit setHasPINLoaded() calls in each test drive that flag —
// keeps the only-one-flag-flipped scenarios deterministic.

import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  AdaptersProvider,
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
} from "@prl-wallet/app-state";
import type { WalletSecretsPort, ServicesPorts } from "@prl-wallet/services";

// Stub the bootstrap hook so the gate's hasPINLoaded flag flips only via
// explicit test-driven setHasPINLoaded(...) calls. The hook's real behavior
// is exercised indirectly elsewhere (apps-flows tests + Wave 4 mobile).
vi.mock("@prl-wallet/app-flows", async (orig) => {
  const actual = await orig<typeof import("@prl-wallet/app-flows")>();
  return {
    ...actual,
    useBootstrapSecurity: () => {},
  };
});

import { HydrationGate } from "../HydrationGate";

function makeFakeStoragePort(): StoragePort {
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

function makeFakeSecrets(): WalletSecretsPort {
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

function makeBundle(): AdaptersBundle {
  const storage = makeFakeStoragePort();
  const secrets = makeFakeSecrets();
  const walletList = createWalletListStore(storage);
  const pin = createPinStore();
  // : createLockStore now accepts StoragePort for persisted idleTimeoutMs.
  const lock = createLockStore(makeFakeStoragePort());
  const networkGate = createNetworkGateStore(storage);

  // Minimal services literal — the gate only reads stores, not services,
  // but ServicesPorts must be structurally complete for AdaptersBundle.
  const services: ServicesPorts = {
    secrets,
    registry: {
      listWallets: async () => [],
      getWallet: async () => null,
      getActiveWalletId: async () => null,
      addWallet: async () => {},
      removeWallet: async () => {},
      setActiveWalletId: async () => {},
      updateWalletBalance: async () => {},
    },
    blockbook: () =>
      ({
        ping: async () => ({ healthy: true, networkId: "x", blockbook: {} }),
        getAddress: async () => ({}) as never,
        getTransaction: async () => ({}) as never,
        getUtxos: async () => [],
        estimateFee: async () => "0",
        sendTransaction: async () => "txid",
      }) as never,
    runtime: { now: () => 0, createId: () => "id" },
  };

  const clipboardStub: ClipboardPort = {
    setString: async () => {},
  };
  const sharingStub: SharingPort = {
    share: async () => {},
  };
  const networkGateStub: NetworkGatePort = {
    isOpen: () => true,
    subscribe: () => () => {},
  };
  const clockStub: ClockPort = {
    now: () => 0,
  };

  return {
    ports: {
      clipboard: clipboardStub,
      sharing: sharingStub,
      storage,
      networkGate: networkGateStub,
      clock: clockStub,
    },
    services,
    stores: { walletList, pin, lock, networkGate },
  };
}

describe("HydrationGate — hydration gate", () => {
  it("renders the spinner when _hasHydrated=false AND hasPINLoaded=false", () => {
    const bundle = makeBundle();
    // Both flags start false (walletList._hasHydrated default + pin.hasPINLoaded default).
    render(
      <AdaptersProvider value={bundle}>
        <HydrationGate>
          <div data-testid="children">READY</div>
        </HydrationGate>
      </AdaptersProvider>,
    );
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading wallet/i }),
    ).toBeInTheDocument();
  });

  it("renders children when _hasHydrated=true AND hasPINLoaded=true", () => {
    const bundle = makeBundle();
    render(
      <AdaptersProvider value={bundle}>
        <HydrationGate>
          <div data-testid="children">READY</div>
        </HydrationGate>
      </AdaptersProvider>,
    );
    act(() => {
      bundle.stores.walletList.getState().setHasHydrated(true);
      bundle.stores.pin.getState().setHasPINLoaded(true);
    });
    expect(screen.getByTestId("children")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /loading wallet/i }),
    ).not.toBeInTheDocument();
  });

  it("still renders spinner when only _hasHydrated=true (waits for hasPINLoaded)", () => {
    const bundle = makeBundle();
    render(
      <AdaptersProvider value={bundle}>
        <HydrationGate>
          <div data-testid="children">READY</div>
        </HydrationGate>
      </AdaptersProvider>,
    );
    act(() => {
      bundle.stores.walletList.getState().setHasHydrated(true);
      // pin.hasPINLoaded stays false
    });
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading wallet/i }),
    ).toBeInTheDocument();
  });

  it("still renders spinner when only hasPINLoaded=true (waits for _hasHydrated)", () => {
    const bundle = makeBundle();
    render(
      <AdaptersProvider value={bundle}>
        <HydrationGate>
          <div data-testid="children">READY</div>
        </HydrationGate>
      </AdaptersProvider>,
    );
    act(() => {
      bundle.stores.pin.getState().setHasPINLoaded(true);
      // walletList._hasHydrated stays false
    });
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading wallet/i }),
    ).toBeInTheDocument();
  });
});
