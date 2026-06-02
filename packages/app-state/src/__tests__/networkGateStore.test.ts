// Wave 0 — RED state.
// This test file references (createNetworkGateStore(storage)).
// It will turn GREEN when Wave 2 () lands.
//
// Note: This package uses Jest (jest.config.cjs), not Vitest.
// All spy/mock APIs use jest.* rather than vi.*.

import type { StoragePort } from "../storagePort.js";
import { createNetworkGateStore } from "../networkGateStore.js";

/**
 * In-memory StoragePort fake — mirrors the helper from walletListStore.test.ts.
 * Includes __raw for direct synchronous inspection without await.
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
 * Each test constructs its own fresh storage + store pair.
 * changes the factory signature to:
 * createNetworkGateStore(storage: StoragePort)
 * This test file asserts that contract.
 */
function freshStore() {
  const storage = makeFakeStoragePort();
  // : factory must accept a StoragePort argument
  const store = createNetworkGateStore(storage);
  return { storage, store };
}

describe(": createNetworkGateStore (persist middleware + first-launch default)", () => {
  it("defaults isOpen to false on first launch with empty storage", () => {
    const { store } = freshStore();
    // : first-launch default is isOpen: false (offline)
    expect(store.getState().isOpen).toBe(false);
  });

  it("persists isOpen=true under key 'prl-network-gate' after open", async () => {
    const { storage, store } = freshStore();
    store.getState().open();
    expect(store.getState().isOpen).toBe(true);
    // Allow Zustand persist middleware to flush its async write
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl-network-gate");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    // : persisted JSON must have state.isOpen
    expect(parsed.state.isOpen).toBe(true);
  });

  it("persists isOpen=false under key 'prl-network-gate' after close", async () => {
    const { storage, store } = freshStore();
    store.getState().open();
    await new Promise((r) => setTimeout(r, 50));
    store.getState().close();
    expect(store.getState().isOpen).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl-network-gate");
    const parsed = JSON.parse(raw!);
    expect(parsed.state.isOpen).toBe(false);
  });

  it("hydrates from pre-seeded storage: isOpen=true after rehydration", async () => {
    // Pre-seed the storage with persisted state indicating isOpen=true
    const storage = makeFakeStoragePort();
    await storage.setItem(
      "prl-network-gate",
      JSON.stringify({ state: { isOpen: true }, version: 0 }),
    );
    // : factory reads storage on construction and rehydrates
    const store = createNetworkGateStore(storage);
    // Allow Zustand persist's async rehydration to complete
    await new Promise((r) => setTimeout(r, 50));
    expect(store.getState().isOpen).toBe(true);
  });

  it("partialize discipline: persisted JSON contains only {isOpen}, no action references", async () => {
    const { storage, store } = freshStore();
    store.getState().open();
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl-network-gate");
    const parsed = JSON.parse(raw!);
    // partialize must exclude open/close action functions from the persisted payload
    expect(Object.keys(parsed.state)).toEqual(["isOpen"]);
  });
});
