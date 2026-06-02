// apps/desktop/src/platform/__tests__/storage.contract.test.ts
//
// Wave 2 — / contract tests (activated).

import { describe, it, vi, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { StoragePort } from "@prl-wallet/app-adapters";
import { createWalletListStore } from "@prl-wallet/app-state";

interface MockStoreState {
  data: Map<string, unknown>;
  set: Mock;
  get: Mock;
  delete: Mock;
  save: Mock;
  entries: Mock;
}

const mockStoreState: MockStoreState = {
  data: new Map<string, unknown>(),
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  save: vi.fn(),
  entries: vi.fn(),
};

function wireMockStoreImpls(): void {
  mockStoreState.set.mockImplementation(async (k: string, v: unknown) => {
    mockStoreState.data.set(k, v);
  });
  mockStoreState.get.mockImplementation(async (k: string) =>
    mockStoreState.data.get(k),
  );
  mockStoreState.delete.mockImplementation(async (k: string) => {
    mockStoreState.data.delete(k);
    return true;
  });
  mockStoreState.save.mockImplementation(async () => {});
  mockStoreState.entries.mockImplementation(async () =>
    Array.from(mockStoreState.data.entries()),
  );
}

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(async () => mockStoreState),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn(async () => "/fake/appdata"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

import { invoke } from "@tauri-apps/api/core";
import { createDesktopStorage } from "../storage";

const mockedInvoke = invoke as unknown as Mock;

describe("createDesktopStorage — metadata persistence contract", () => {
  beforeEach(() => {
    mockStoreState.data.clear();
    mockStoreState.set.mockReset();
    mockStoreState.get.mockReset();
    mockStoreState.delete.mockReset();
    mockStoreState.save.mockReset();
    mockStoreState.entries.mockReset();
    wireMockStoreImpls();
    mockedInvoke.mockReset();
    mockedInvoke.mockResolvedValue(undefined);
  });

  it("setItem persists key/value to the underlying plugin-store", async () => {
    const port = createDesktopStorage();
    await port.setItem("k", "v");

    expect(mockStoreState.set).toHaveBeenCalledTimes(1);
    expect(mockStoreState.set).toHaveBeenCalledWith("k", "v");
  });

  it("setItem triggers exactly one durable write (P-NEW-1 atomic-save)", async () => {
    const port = createDesktopStorage();
    await port.setItem("k", "v");

    const atomicSaveCalls = mockedInvoke.mock.calls.filter(
      (c) => c[0] === "metadata_save_atomic",
    );
    expect(atomicSaveCalls).toHaveLength(1);
    // store.save() must NOT be called — Wave 2 endorses Option A (Rust atomic
    // write-then-rename), not the non-atomic plugin-store save.
    expect(mockStoreState.save).not.toHaveBeenCalled();
  });

  it("removeItem triggers exactly one durable write", async () => {
    mockStoreState.data.set("k", "v");
    const port = createDesktopStorage();
    await port.removeItem("k");

    expect(mockStoreState.delete).toHaveBeenCalledTimes(1);
    expect(mockStoreState.delete).toHaveBeenCalledWith("k");

    const atomicSaveCalls = mockedInvoke.mock.calls.filter(
      (c) => c[0] === "metadata_save_atomic",
    );
    expect(atomicSaveCalls).toHaveLength(1);
  });

  it("getItem returns null when the underlying store has no entry", async () => {
    const port = createDesktopStorage();
    const value = await port.getItem("missing");
    expect(value).toBeNull();
  });
});

describe("walletType invariant — (walletType never persists in plugin-store)", () => {
  function makeFakeStoragePort(): StoragePort & {
    __raw: (key: string) => string | null;
  } {
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

  function findKeyDeep(value: unknown, target: string): boolean {
    if (value === null || typeof value !== "object") return false;
    if (Array.isArray(value)) {
      return value.some((v) => findKeyDeep(v, target));
    }
    const obj = value as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (k === target) return true;
      if (findKeyDeep(obj[k], target)) return true;
    }
    return false;
  }

  it("partialize excludes walletType from the persisted JSON", async () => {
    const fake = makeFakeStoragePort();
    const store = createWalletListStore(fake);

    store.getState().addWallet({
      id: "w1",
      name: "A",
      networkId: "btc-mainnet",
      createdAt: 1,
    });

    // Allow Zustand persist middleware to flush its microtask-scheduled write.
    await new Promise((r) => setTimeout(r, 0));

    const raw = fake.__raw("prl_wallet_registry");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);

    expect(findKeyDeep(parsed, "walletType")).toBe(false);
  });
});
