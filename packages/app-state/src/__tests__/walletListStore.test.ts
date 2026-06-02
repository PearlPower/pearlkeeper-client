import type { StoragePort } from "../storagePort.js";
import { createWalletListStore } from "../walletListStore.js";

/**
 * In-memory StoragePort fake. Replaces the module-level persistent-storage
 * mock used by the prior mobile-side test — the factory accepts any
 * StoragePort, so tests inject this fake directly and skip module-reload
 * hacks.
 */
interface FakeStoragePort extends StoragePort {
  __raw: (key: string) => string | null;
}

function makeFakeStoragePort(): FakeStoragePort {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      map.set(k, v);
    },
    removeItem: async (k) => {
      map.delete(k);
    },
    __raw: (k) => map.get(k) ?? null,
  };
}

/**
 * Each test constructs its own fresh storage + store pair inline. This
 * mirrors the original mobile test's `jest.resetModules()` + `loadStore()`
 * pattern and is necessary so `.getState()` can observe the synchronous
 * pre-hydration state (e.g. `_hasHydrated === false`) before the Zustand
 * persist middleware flushes its microtask-based rehydration.
 */
function freshStore() {
  const storage = makeFakeStoragePort();
  const store = createWalletListStore(storage);
  return { storage, store };
}

describe("walletListStore (Zustand persist)", () => {
  it("starts with empty wallets and null activeWalletId", () => {
    const { store } = freshStore();
    const state = store.getState();
    expect(state.wallets).toEqual([]);
    expect(state.activeWalletId).toBeNull();
  });

  it("starts with _hasHydrated = false (not persisted)", () => {
    const { store } = freshStore();
    const state = store.getState();
    expect(state._hasHydrated).toBe(false);
  });

  it("addWallet appends a WalletRecord to wallets", () => {
    const { store } = freshStore();
    const record = {
      id: "w1",
      name: "Test Wallet",
      networkId: "prl-mainnet",
      createdAt: 1000,
    };
    store.getState().addWallet(record);
    expect(store.getState().wallets).toHaveLength(1);
    expect(store.getState().wallets[0]).toEqual(record);
  });

  it("removeWallet removes only the target wallet", () => {
    const { store } = freshStore();
    const a = { id: "a", name: "A", networkId: "prl-mainnet", createdAt: 1 };
    const b = { id: "b", name: "B", networkId: "prl-mainnet", createdAt: 2 };
    store.getState().addWallet(a);
    store.getState().addWallet(b);
    store.getState().removeWallet("a");
    const wallets = store.getState().wallets;
    expect(wallets).toHaveLength(1);
    expect(wallets[0].id).toBe("b");
  });

  it("removeWallet clears activeWalletId when the active wallet is deleted", () => {
    const { store } = freshStore();
    const record = {
      id: "w1",
      name: "W",
      networkId: "prl-mainnet",
      createdAt: 1,
    };
    store.getState().addWallet(record);
    store.getState().setActiveWalletId("w1");
    store.getState().removeWallet("w1");
    expect(store.getState().activeWalletId).toBeNull();
  });

  it("updateWalletBalance sets lastKnownBalance on the target wallet", () => {
    const { store } = freshStore();
    const record = {
      id: "w1",
      name: "Test",
      networkId: "prl-mainnet",
      createdAt: 1000,
    };
    store.getState().addWallet(record);
    store.getState().updateWalletBalance("w1", "50000");
    const wallet = store
      .getState()
      .wallets.find((w: { id: string }) => w.id === "w1");
    expect(wallet?.lastKnownBalance).toBe("50000");
  });

  it("updateWalletReceiveAddress sets nextReceiveAddress on the target wallet", () => {
    const { store } = freshStore();
    const record = {
      id: "w1",
      name: "Test",
      networkId: "prl-mainnet",
      createdAt: 1000,
    };
    store.getState().addWallet(record);
    store.getState().updateWalletReceiveAddress("w1", "prl1-next-receive");
    const wallet = store
      .getState()
      .wallets.find((w: { id: string }) => w.id === "w1");
    expect(wallet?.nextReceiveAddress).toBe("prl1-next-receive");
  });

  it("updateWalletBalance does not affect other wallets", () => {
    const { store } = freshStore();
    const a = { id: "a", name: "A", networkId: "prl-mainnet", createdAt: 1 };
    const b = { id: "b", name: "B", networkId: "prl-mainnet", createdAt: 2 };
    store.getState().addWallet(a);
    store.getState().addWallet(b);
    store.getState().updateWalletBalance("a", "10000");
    const walletB = store
      .getState()
      .wallets.find((w: { id: string }) => w.id === "b");
    expect(walletB?.lastKnownBalance).toBeUndefined();
  });

  it("WalletRecord without lastKnownBalance remains valid (optional field)", () => {
    const { store } = freshStore();
    const record = {
      id: "w1",
      name: "Test",
      networkId: "prl-mainnet",
      createdAt: 1000,
    };
    store.getState().addWallet(record);
    const wallet = store.getState().wallets[0];
    expect(wallet.lastKnownBalance).toBeUndefined();
  });

  it("lastKnownBalance is persisted via the injected StoragePort", async () => {
    const { storage, store } = freshStore();
    const record = {
      id: "w1",
      name: "W",
      networkId: "prl-mainnet",
      createdAt: 1,
    };
    store.getState().addWallet(record);
    store.getState().updateWalletBalance("w1", "99999");
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl_wallet_registry");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state.wallets[0].lastKnownBalance).toBe("99999");
  });

  it("nextReceiveAddress is persisted via the injected StoragePort", async () => {
    const { storage, store } = freshStore();
    const record = {
      id: "w1",
      name: "W",
      networkId: "prl-mainnet",
      createdAt: 1,
    };
    store.getState().addWallet(record);
    store.getState().updateWalletReceiveAddress("w1", "prl1-next-receive");
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl_wallet_registry");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state.wallets[0].nextReceiveAddress).toBe(
      "prl1-next-receive",
    );
  });

  it("partialize excludes _hasHydrated from persisted storage", async () => {
    const { storage, store } = freshStore();
    const record = {
      id: "w1",
      name: "W",
      networkId: "prl-mainnet",
      createdAt: 1,
    };
    store.getState().addWallet(record);
    store.getState().setHasHydrated(true);
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl_wallet_registry");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state).not.toHaveProperty("_hasHydrated");
    expect(parsed.state.wallets).toHaveLength(1);
  });

  // ────────────────────────────────────────────────────────────────────────
  // analyticsConsent default state, setter, persistence.
  // ────────────────────────────────────────────────────────────────────────

  it("starts with analyticsConsent = { granted: false, decidedAt: null } ( never-granted default)", () => {
    const { store } = freshStore();
    const state = store.getState();
    expect(state.analyticsConsent).toEqual({
      granted: false,
      decidedAt: null,
    });
  });

  it("setAnalyticsConsent updates the analyticsConsent field", () => {
    const { store } = freshStore();
    store.getState().setAnalyticsConsent({ granted: true, decidedAt: 1234 });
    expect(store.getState().analyticsConsent).toEqual({
      granted: true,
      decidedAt: 1234,
    });
    // Toggle revoke ().
    store.getState().setAnalyticsConsent({ granted: false, decidedAt: 5678 });
    expect(store.getState().analyticsConsent).toEqual({
      granted: false,
      decidedAt: 5678,
    });
  });

  it("analyticsConsent is persisted via the injected StoragePort", async () => {
    const { storage, store } = freshStore();
    store.getState().setAnalyticsConsent({ granted: true, decidedAt: 9001 });
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl_wallet_registry");
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state.analyticsConsent).toEqual({
      granted: true,
      decidedAt: 9001,
    });
  });
});
