// apps/desktop/src/platform/__tests__/idleLock.test.ts
//
// Task 1 — idleLock contract verification ().
//
// Locks the new signature: initIdleLock(lockStore: LockStore) subscribes to
// lockStore.idleTimeoutMs and reinstalls the underlying setTimeout whenever
// the value changes. When idleTimeoutMs === null (the "Never" Settings
// option), uninstall any pending timer; user-input listeners stay
// registered (cheap, app-lifetime). Defensive try/catch around lock().
//
// Locks invariants: 4-event reset set (mousemove/keydown/wheel/touchstart),
// passive: true listener flag, cleanup tears down listeners + clears active
// timer + unsubscribes from lockStore.

import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { initIdleLock } from "@/platform/idleLock";
import {
  createLockStore,
  type StoragePort,
  type LockStore,
} from "@prl-wallet/app-state";

/**
 * In-memory StoragePort fake — mirrors networkGateStore.test.ts /
 * lockStore.test.ts FakeStoragePort. The lockStore persist middleware
 * writes asynchronously; tests construct the store and explicitly seed
 * idleTimeoutMs via setIdleTimeoutMs to make the starting state
 * deterministic without waiting on hydration.
 */
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

function freshLockStore(): LockStore {
  return createLockStore(makeFakeStoragePort());
}

describe("initIdleLock (lockStore-subscribed signature)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("A: registers passive listeners for the 4 reset events and does not fire before idleTimeoutMs", () => {
    const spy = vi.spyOn(document, "addEventListener");
    const lockStore = freshLockStore();
    const lockSpy = vi.spyOn(lockStore.getState(), "lock");

    initIdleLock(lockStore);

    const calls = spy.mock.calls.filter(([ev]) =>
      ["mousemove", "keydown", "wheel", "touchstart"].includes(ev as string),
    );
    expect(calls.length).toBe(4);
    for (const [, , opts] of calls) {
      expect(opts).toMatchObject({ passive: true });
    }

    // Default idleTimeoutMs is 15 * 60 * 1000 = 900_000ms. lock() must NOT
    // fire before that.
    vi.advanceTimersByTime(899_999);
    expect(lockSpy).not.toHaveBeenCalled();
  });

  test("B: input event resets the timer (no early lock at original deadline)", () => {
    const lockStore = freshLockStore();
    lockStore.getState().setIdleTimeoutMs(900_000);
    const lockSpy = vi.spyOn(lockStore.getState(), "lock");

    initIdleLock(lockStore);

    vi.advanceTimersByTime(800_000);
    document.dispatchEvent(new Event("mousemove"));
    // Original deadline (900_000) — should NOT fire because reset bumped it.
    vi.advanceTimersByTime(100_000);
    expect(lockSpy).not.toHaveBeenCalled();
    // Bumped deadline = 800_000 + 900_000 = 1_700_000 — must fire by now.
    vi.advanceTimersByTime(800_000);
    expect(lockSpy).toHaveBeenCalledTimes(1);
  });

  test("C: setIdleTimeoutMs(5000) mid-session clears pending 1000ms timer and starts fresh 5000ms timer", () => {
    const lockStore = freshLockStore();
    lockStore.getState().setIdleTimeoutMs(1000);
    const lockSpy = vi.spyOn(lockStore.getState(), "lock");

    initIdleLock(lockStore);

    // 800ms in, swap to 5000ms — pending 1000ms should be cleared.
    vi.advanceTimersByTime(800);
    lockStore.getState().setIdleTimeoutMs(5000);

    // Past the OLD deadline (1000ms total elapsed) — must NOT fire.
    vi.advanceTimersByTime(300);
    expect(lockSpy).not.toHaveBeenCalled();

    // Past the NEW deadline (800 + 5000 + a margin) — must fire exactly once.
    vi.advanceTimersByTime(5000);
    expect(lockSpy).toHaveBeenCalledTimes(1);
  });

  test("D: idleTimeoutMs=null (Never) does NOT fire lock() and listeners stay registered", () => {
    const lockStore = freshLockStore();
    lockStore.getState().setIdleTimeoutMs(null);
    const lockSpy = vi.spyOn(lockStore.getState(), "lock");

    const cleanup = initIdleLock(lockStore);

    vi.advanceTimersByTime(60_000);
    expect(lockSpy).not.toHaveBeenCalled();

    // Listeners are still wired — dispatch must not crash.
    expect(() => {
      document.dispatchEvent(new Event("mousemove"));
      document.dispatchEvent(new Event("keydown"));
      document.dispatchEvent(new Event("wheel"));
      document.dispatchEvent(new Event("touchstart"));
    }).not.toThrow();

    vi.advanceTimersByTime(60_000);
    expect(lockSpy).not.toHaveBeenCalled();

    cleanup();
  });

  test("E: transition into Never mid-session clears pending timer (no fire)", () => {
    const lockStore = freshLockStore();
    lockStore.getState().setIdleTimeoutMs(1000);
    const lockSpy = vi.spyOn(lockStore.getState(), "lock");

    initIdleLock(lockStore);

    vi.advanceTimersByTime(500);
    lockStore.getState().setIdleTimeoutMs(null);
    vi.advanceTimersByTime(60_000);
    expect(lockSpy).not.toHaveBeenCalled();
  });

  test("F: transition out of Never mid-session installs a fresh timer", () => {
    const lockStore = freshLockStore();
    lockStore.getState().setIdleTimeoutMs(null);
    const lockSpy = vi.spyOn(lockStore.getState(), "lock");

    initIdleLock(lockStore);

    vi.advanceTimersByTime(10_000);
    expect(lockSpy).not.toHaveBeenCalled();

    lockStore.getState().setIdleTimeoutMs(1000);

    vi.advanceTimersByTime(1500);
    expect(lockSpy).toHaveBeenCalledTimes(1);
  });

  test("G: cleanup clears pending setTimeout, removes listeners, unsubscribes from lockStore", () => {
    const lockStore = freshLockStore();
    lockStore.getState().setIdleTimeoutMs(1000);
    const lockSpy = vi.spyOn(lockStore.getState(), "lock");

    const removeSpy = vi.spyOn(document, "removeEventListener");
    const cleanup = initIdleLock(lockStore);

    cleanup();

    // Pending timer must NOT fire after cleanup.
    vi.advanceTimersByTime(2000);
    expect(lockSpy).not.toHaveBeenCalled();

    // All 4 listeners must have been removed.
    const removeCalls = removeSpy.mock.calls.filter(([ev]) =>
      ["mousemove", "keydown", "wheel", "touchstart"].includes(ev as string),
    );
    expect(removeCalls.length).toBe(4);

    // Verify the lockStore subscription was severed: changing idleTimeoutMs
    // after cleanup must NOT install a new timer.
    lockStore.getState().setIdleTimeoutMs(500);
    vi.advanceTimersByTime(2000);
    expect(lockSpy).not.toHaveBeenCalled();
  });

  test("H: defensive try/catch — a throwing lock() does NOT propagate; subsequent input still resets the timer", () => {
    const lockStore = freshLockStore();
    lockStore.getState().setIdleTimeoutMs(1000);

    // Replace lock() with a throwing variant on the live state object.
    const throwingLock = vi.fn(() => {
      throw new Error("boom");
    });
    lockStore.setState({ lock: throwingLock });

    initIdleLock(lockStore);

    // Timer fires → throwingLock invoked → must not propagate.
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(throwingLock).toHaveBeenCalledTimes(1);

    // Subsequent input event resets cleanly — no zombie timer state.
    document.dispatchEvent(new Event("mousemove"));
    expect(() => vi.advanceTimersByTime(999)).not.toThrow();
    expect(throwingLock).toHaveBeenCalledTimes(1);

    expect(() => vi.advanceTimersByTime(2)).not.toThrow();
    expect(throwingLock).toHaveBeenCalledTimes(2);
  });
});
