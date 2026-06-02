// Task 2 — RED-then-GREEN.
// This test file references (createLockStore(storage) + idleTimeoutMs).
// Twin of networkGateStore.test.ts — see RESEARCH §Pattern 5 / §Validation Architecture.
//
// Note: This package uses Jest (jest.config.cjs), not Vitest.
// All spy/mock APIs use jest.* rather than vi.*.

import type { StoragePort } from "../storagePort.js";
import { createLockStore } from "../lockStore.js";

/**
 * In-memory StoragePort fake — mirrors the helper from networkGateStore.test.ts.
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
 * createLockStore(storage: StoragePort)
 * with persisted `idleTimeoutMs: number | null` (default 15 * 60 * 1000).
 */
function freshStore() {
  const storage = makeFakeStoragePort();
  const store = createLockStore(storage);
  return { storage, store };
}

describe(": createLockStore (persist middleware + idleTimeoutMs)", () => {
  it("defaults idleTimeoutMs to 15 * 60 * 1000 (= 900000) on first launch with empty storage", () => {
    const { store } = freshStore();
    expect(store.getState().idleTimeoutMs).toBe(15 * 60 * 1000);
    expect(store.getState().idleTimeoutMs).toBe(900_000);
  });

  it("persists numeric idleTimeoutMs under key 'prl-lock-store' after setIdleTimeoutMs(60_000)", async () => {
    const { storage, store } = freshStore();
    store.getState().setIdleTimeoutMs(60_000);
    expect(store.getState().idleTimeoutMs).toBe(60_000);
    // Allow Zustand persist middleware to flush its async write
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl-lock-store");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.idleTimeoutMs).toBe(60_000);
  });

  it("persists null (Never) under key 'prl-lock-store' after setIdleTimeoutMs(null)", async () => {
    const { storage, store } = freshStore();
    store.getState().setIdleTimeoutMs(null);
    expect(store.getState().idleTimeoutMs).toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl-lock-store");
    const parsed = JSON.parse(raw!);
    expect(parsed.state.idleTimeoutMs).toBeNull();
  });

  it("hydrates from pre-seeded storage: idleTimeoutMs=300000 after rehydration", async () => {
    const storage = makeFakeStoragePort();
    await storage.setItem(
      "prl-lock-store",
      JSON.stringify({ state: { idleTimeoutMs: 300_000 }, version: 0 }),
    );
    const store = createLockStore(storage);
    // Allow Zustand persist's async rehydration to complete
    await new Promise((r) => setTimeout(r, 50));
    expect(store.getState().idleTimeoutMs).toBe(300_000);
  });

  it("partialize discipline: persisted JSON contains only {idleTimeoutMs}, never isLocked/failedAttempts/lockUntil", async () => {
    const { storage, store } = freshStore();
    // Mutate session-scoped state to ensure it does NOT bleed into storage.
    store.getState().lock();
    store.getState().recordFailedAttempt();
    store.getState().setIdleTimeoutMs(120_000);
    await new Promise((r) => setTimeout(r, 50));
    const raw = await storage.getItem("prl-lock-store");
    const parsed = JSON.parse(raw!);
    // partialize must select ONLY idleTimeoutMs.
    expect(Object.keys(parsed.state)).toEqual(["idleTimeoutMs"]);
    expect(parsed.state).not.toHaveProperty("isLocked");
    expect(parsed.state).not.toHaveProperty("failedAttempts");
    expect(parsed.state).not.toHaveProperty("lockUntil");
  });

  it("preserves existing lock/unlock/escalating-attempt behavior verbatim", () => {
    const { store } = freshStore();
    // Boot default: isLocked=true (prevents content flash before authentication)
    expect(store.getState().isLocked).toBe(true);
    expect(store.getState().failedAttempts).toBe(0);
    expect(store.getState().lockUntil).toBeNull();

    // unlock() resets all session state
    store.getState().unlock();
    expect(store.getState().isLocked).toBe(false);
    expect(store.getState().failedAttempts).toBe(0);
    expect(store.getState().lockUntil).toBeNull();

    // lock() flips isLocked back to true
    store.getState().lock();
    expect(store.getState().isLocked).toBe(true);

    // recordFailedAttempt — start fresh
    store.getState().resetAttempts();
    expect(store.getState().failedAttempts).toBe(0);

    // < 5 attempts: no lockUntil
    for (let i = 0; i < 4; i += 1) store.getState().recordFailedAttempt();
    expect(store.getState().failedAttempts).toBe(4);
    expect(store.getState().lockUntil).toBeNull();

    // 5th attempt → 30 second lock
    const before5 = Date.now();
    store.getState().recordFailedAttempt();
    expect(store.getState().failedAttempts).toBe(5);
    expect(store.getState().lockUntil).not.toBeNull();
    const lockUntil5 = store.getState().lockUntil!;
    expect(lockUntil5 - before5).toBeGreaterThanOrEqual(30 * 1000 - 50);
    expect(lockUntil5 - before5).toBeLessThanOrEqual(30 * 1000 + 50);

    // attempts 6, 7 — still 30s window math (>= 5, < 8)
    store.getState().recordFailedAttempt();
    store.getState().recordFailedAttempt();
    expect(store.getState().failedAttempts).toBe(7);

    // 8th attempt → 5 minute lock
    const before8 = Date.now();
    store.getState().recordFailedAttempt();
    expect(store.getState().failedAttempts).toBe(8);
    const lockUntil8 = store.getState().lockUntil!;
    expect(lockUntil8 - before8).toBeGreaterThanOrEqual(5 * 60 * 1000 - 50);
    expect(lockUntil8 - before8).toBeLessThanOrEqual(5 * 60 * 1000 + 50);

    // 9th → still 5min (>= 8, < 10)
    store.getState().recordFailedAttempt();
    expect(store.getState().failedAttempts).toBe(9);

    // 10th attempt → 1 hour lock
    const before10 = Date.now();
    store.getState().recordFailedAttempt();
    expect(store.getState().failedAttempts).toBe(10);
    const lockUntil10 = store.getState().lockUntil!;
    expect(lockUntil10 - before10).toBeGreaterThanOrEqual(60 * 60 * 1000 - 50);
    expect(lockUntil10 - before10).toBeLessThanOrEqual(60 * 60 * 1000 + 50);

    // resetAttempts clears
    store.getState().resetAttempts();
    expect(store.getState().failedAttempts).toBe(0);
    expect(store.getState().lockUntil).toBeNull();
  });

  it("falls back to default idleTimeoutMs when storage holds malformed JSON (does not throw)", async () => {
    const storage = makeFakeStoragePort();
    await storage.setItem("prl-lock-store", "{not-valid-json");
    // Construction must not throw even with malformed pre-seeded JSON.
    const store = createLockStore(storage);
    await new Promise((r) => setTimeout(r, 50));
    // On rehydration failure, Zustand persist falls back to the initial state.
    expect(store.getState().idleTimeoutMs).toBe(15 * 60 * 1000);
  });
});
