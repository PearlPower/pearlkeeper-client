// apps/desktop/src/security/__tests__/installLockClear.test.ts
//
// Task 1 — GREEN activation of Wave 0 RED stubs.
// Tests the lockStore false→true transition listener contract.

import { describe, test, expect, vi } from "vitest";
import { installLockClear } from "@/security/installLockClear";
import { buildTestBundle } from "@/__tests__/_harness/factories";

describe("installLockClear", () => {
  test("fires onLock on isLocked false→true transition", () => {
    const bundle = buildTestBundle();
    // Start unlocked so we can observe the transition
    bundle.stores.lock.getState().unlock();
    expect(bundle.stores.lock.getState().isLocked).toBe(false);

    const onLock = vi.fn();
    installLockClear(bundle.stores.lock, onLock);

    bundle.stores.lock.getState().lock();

    expect(onLock).toHaveBeenCalledTimes(1);
  });

  test("does NOT fire on isLocked true→false transition", () => {
    const bundle = buildTestBundle();
    // Start locked (default)
    expect(bundle.stores.lock.getState().isLocked).toBe(true);

    const onLock = vi.fn();
    installLockClear(bundle.stores.lock, onLock);

    // Transition from locked → unlocked
    bundle.stores.lock.getState().unlock();

    expect(onLock).not.toHaveBeenCalled();
  });

  test("does NOT fire on initial subscription (Pitfall 2)", () => {
    const bundle = buildTestBundle();
    const onLock = vi.fn();

    // Simply installing should NOT fire onLock
    installLockClear(bundle.stores.lock, onLock);

    expect(onLock).not.toHaveBeenCalled();
  });

  test("callback never throws when onLock throws", () => {
    const bundle = buildTestBundle();
    bundle.stores.lock.getState().unlock();

    const onLock = vi.fn(() => {
      throw new Error("boom");
    });
    installLockClear(bundle.stores.lock, onLock);

    // Triggering the lock transition should NOT propagate the exception
    expect(() => bundle.stores.lock.getState().lock()).not.toThrow();
    expect(onLock).toHaveBeenCalledTimes(1);
  });
});
