// Wave 0 — RED state.
// Asserts the contract Wave 4 () must satisfy.
// This file imports StatusBar from '../components/StatusBar' which does not
// yet exist. Tests will fail at import time until Wave 4 lands.
//
// @testing-library/user-event is not installed; we use fireEvent.click from
// RTL (same pattern as keychainUnavailableScreen.test.tsx).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

// Mock Tauri core — StatusBar will call invoke on toggle
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {}),
}));

// Import AFTER mocks
import { StatusBar } from "../components/StatusBar";

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

function makeBundle(
  networkGateStoreOverride?: ReturnType<typeof createNetworkGateStore>,
): AdaptersBundle {
  const storage = makeFakeStoragePort();
  const secrets = makeFakeSecrets();
  const walletList = createWalletListStore(storage);
  const pin = createPinStore();
  // : createLockStore now accepts StoragePort for persisted idleTimeoutMs.
  const lock = createLockStore(makeFakeStoragePort());
  // : createNetworkGateStore now accepts StoragePort
  const networkGateStore =
    networkGateStoreOverride ?? createNetworkGateStore(makeFakeStoragePort());

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

  // StatusBar reads networkGateStore directly from the bundle stores
  // adds networkGateStore to AdaptersBundle stores
  const networkGatePort: NetworkGatePort = {
    isOpen: () => networkGateStore.getState().isOpen,
    subscribe: () => () => {},
  };

  const clipboardStub: ClipboardPort = { setString: async () => {} };
  const sharingStub: SharingPort = { share: async () => {} };
  const clockStub: ClockPort = { now: () => 0 };

  return {
    ports: {
      clipboard: clipboardStub,
      sharing: sharingStub,
      storage,
      networkGate: networkGatePort,
      clock: clockStub,
    },
    services,
    // : StatusBar reads networkGateStore from stores
    stores: {
      walletList,
      pin,
      lock,
      networkGate: networkGateStore,
    } as AdaptersBundle["stores"],
  };
}

describe(": StatusBar — locked copy + toggle + a11y", () => {
  it("renders 'Network: Offline — sensitive ops gated' (verbatim) when isOpen === false ( + + )", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    // : default is isOpen: false
    const bundle = makeBundle(networkGateStore);
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    // Exact string match — extends offline copy with suffix
    expect(
      screen.getByText("Network: Offline — sensitive ops gated"),
    ).toBeInTheDocument();
  });

  it("renders 'Network: Online' (verbatim) when isOpen === true ( + )", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    // Pre-open the gate
    networkGateStore.getState().open();
    const bundle = makeBundle(networkGateStore);
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    // Exact string match — T-19-03 locked copy assertion
    expect(screen.getByText("Network: Online")).toBeInTheDocument();
  });

  it("Switch element has aria-label='Toggle network access' (verbatim) (UI-SPEC a11y)", () => {
    const bundle = makeBundle();
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    // Exact aria-label match — T-19-03 locked copy assertion
    expect(
      screen.getByRole("switch", { name: "Toggle network access" }),
    ).toBeInTheDocument();
  });

  it("click Switch when offline → calls store.open(); rerenders to show 'Network: Online'", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    // starts offline (default)
    const bundle = makeBundle(networkGateStore);
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    expect(
      screen.getByText("Network: Offline — sensitive ops gated"),
    ).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("switch"));
    });

    expect(networkGateStore.getState().isOpen).toBe(true);
    expect(screen.getByText("Network: Online")).toBeInTheDocument();
  });

  it("click Switch when online → calls store.close(); rerenders to show 'Network: Offline'", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    networkGateStore.getState().open(); // start online
    const bundle = makeBundle(networkGateStore);
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    expect(screen.getByText("Network: Online")).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("switch"));
    });

    expect(networkGateStore.getState().isOpen).toBe(false);
    expect(
      screen.getByText("Network: Offline — sensitive ops gated"),
    ).toBeInTheDocument();
  });

  it("section element has role='status' (UI-SPEC §Accessibility)", () => {
    const bundle = makeBundle();
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("offline badge has bg-muted class; online badge has bg-accent class (UI-SPEC §Color)", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    const bundle = makeBundle(networkGateStore);
    const { rerender } = render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );

    // offline: badge should have bg-muted
    const offlineBadge = screen
      .getByText("Network: Offline — sensitive ops gated")
      .closest("span");
    expect(offlineBadge).toHaveClass("bg-muted");

    // switch to online
    act(() => {
      networkGateStore.getState().open();
    });
    rerender(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );

    // online: badge should have bg-accent
    const onlineBadge = screen.getByText("Network: Online").closest("span");
    expect(onlineBadge).toHaveClass("bg-accent");
  });
});

describe(": StatusBar — offline height + suffix + invariants", () => {
  it("online state: renders 'Network: Online' label, h-8 height class, no offline suffix", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    networkGateStore.getState().open();
    const bundle = makeBundle(networkGateStore);
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    expect(screen.getByText("Network: Online")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("h-8");
    expect(
      screen.queryByText("Network: Offline — sensitive ops gated"),
    ).not.toBeInTheDocument();
  });

  it("offline state: renders 'Network: Offline — sensitive ops gated' label, h-12 height class", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    // default is offline
    const bundle = makeBundle(networkGateStore);
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    expect(
      screen.getByText("Network: Offline — sensitive ops gated"),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("h-12");
  });

  it("offline state uses neutral muted color (NOT destructive/red)", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    const bundle = makeBundle(networkGateStore);
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    const badge = screen
      .getByText("Network: Offline — sensitive ops gated")
      .closest("span");
    expect(badge).toHaveClass("bg-muted");
    expect(badge).not.toHaveClass("bg-destructive");
    expect(badge).not.toHaveClass("text-destructive");
  });

  it("Switch carries aria-label 'Toggle network access' regardless of state", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    const bundle = makeBundle(networkGateStore);
    const { rerender } = render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    // offline
    expect(
      screen.getByRole("switch", { name: "Toggle network access" }),
    ).toBeInTheDocument();

    // switch to online
    act(() => {
      networkGateStore.getState().open();
    });
    rerender(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    // online
    expect(
      screen.getByRole("switch", { name: "Toggle network access" }),
    ).toBeInTheDocument();
  });

  it("container has transition-[height] duration-200 class", () => {
    const bundle = makeBundle();
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    const section = screen.getByRole("status");
    expect(section).toHaveClass("transition-[height]");
    expect(section).toHaveClass("duration-200");
  });

  it("toggle Switch online → calls networkGateStore.close", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    networkGateStore.getState().open(); // start online
    const bundle = makeBundle(networkGateStore);
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("switch"));
    });
    expect(networkGateStore.getState().isOpen).toBe(false);
  });

  it("toggle Switch offline → calls networkGateStore.open", () => {
    const networkGateStore = createNetworkGateStore(makeFakeStoragePort());
    // default is offline
    const bundle = makeBundle(networkGateStore);
    render(
      <AdaptersProvider value={bundle}>
        <StatusBar />
      </AdaptersProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByRole("switch"));
    });
    expect(networkGateStore.getState().isOpen).toBe(true);
  });
});
