// apps/desktop/src/platform/__tests__/lockOnClose.test.ts
//
// Task 3 (B-2) — installCloseLock contract.
//
// The helper accepts a CloseRequestableWindow shape so this test mocks
// onCloseRequested without a real Tauri window. Verifies:
// 1. installCloseLock calls currentWindow.onCloseRequested with a function.
// 2. Invoking the captured callback locks the bundle.
// 3. T-20-12: callback never throws even when lock() throws.

import { describe, test, expect, vi } from "vitest";
import {
  installCloseLock,
  type CloseRequestableWindow,
} from "@/platform/lockOnClose";
import { buildTestBundle } from "../../__tests__/_harness/factories";

describe("installCloseLock ( helper, B-2)", () => {
  test("calls currentWindow.onCloseRequested exactly once with a function", async () => {
    const bundle = buildTestBundle();
    const mockWindow: CloseRequestableWindow = {
      onCloseRequested: vi.fn(() => Promise.resolve(() => {})),
    };
    await installCloseLock(bundle, mockWindow);
    expect(mockWindow.onCloseRequested).toHaveBeenCalledTimes(1);
    const passedFn = (mockWindow.onCloseRequested as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(typeof passedFn).toBe("function");
  });

  test("the registered callback locks the bundle when invoked", async () => {
    const bundle = buildTestBundle();
    // Start unlocked so we can observe the transition (lockStore default is true).
    bundle.stores.lock.getState().unlock();
    expect(bundle.stores.lock.getState().isLocked).toBe(false);

    let captured: (() => void) | null = null;
    const mockWindow: CloseRequestableWindow = {
      onCloseRequested: vi.fn((cb: () => void) => {
        captured = cb;
        return Promise.resolve(() => {});
      }),
    };
    await installCloseLock(bundle, mockWindow);
    expect(captured).not.toBeNull();
    captured!();
    expect(bundle.stores.lock.getState().isLocked).toBe(true);
  });

  test("T-20-12: callback never throws even when lock() throws", async () => {
    const bundle = buildTestBundle();
    // Force lock() to throw by replacing the store state's lock action.
    const originalGetState = bundle.stores.lock.getState;
    vi.spyOn(bundle.stores.lock, "getState").mockImplementation(
      () =>
        ({
          ...originalGetState(),
          lock: () => {
            throw new Error("simulated lock failure");
          },
        }) as ReturnType<typeof originalGetState>,
    );

    let captured: (() => void) | null = null;
    const mockWindow: CloseRequestableWindow = {
      onCloseRequested: vi.fn((cb: () => void) => {
        captured = cb;
        return Promise.resolve(() => {});
      }),
    };
    await installCloseLock(bundle, mockWindow);
    expect(() => captured!()).not.toThrow();
  });
});
