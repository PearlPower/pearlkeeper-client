// apps/desktop/src/security/__tests__/installBlurClear.test.ts
//
// Task 1 — GREEN activation of Wave 0 RED stubs.
// Tests the dual-path blur listener (Tauri + browser) contract.

import { describe, test, expect, vi } from "vitest";
import {
  installBlurClear,
  type FocusChangeableWindow,
} from "@/security/installBlurClear";

describe("installBlurClear", () => {
  test("calls currentWindow.onFocusChanged exactly once", async () => {
    const mockUnlisten = vi.fn();
    const mockWindow: FocusChangeableWindow = {
      onFocusChanged: vi.fn(() => Promise.resolve(mockUnlisten)),
    };
    const onBlur = vi.fn();
    await installBlurClear(mockWindow, onBlur);
    expect(mockWindow.onFocusChanged).toHaveBeenCalledTimes(1);
  });

  test("Tauri payload focused=false → onBlur fires", async () => {
    let capturedHandler: ((event: { payload: boolean }) => void) | null = null;
    const mockWindow: FocusChangeableWindow = {
      onFocusChanged: vi.fn((handler) => {
        capturedHandler = handler;
        return Promise.resolve(() => {});
      }),
    };
    const onBlur = vi.fn();
    await installBlurClear(mockWindow, onBlur);
    expect(capturedHandler).not.toBeNull();
    capturedHandler!({ payload: false });
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test("Tauri payload focused=true → onBlur does NOT fire", async () => {
    let capturedHandler: ((event: { payload: boolean }) => void) | null = null;
    const mockWindow: FocusChangeableWindow = {
      onFocusChanged: vi.fn((handler) => {
        capturedHandler = handler;
        return Promise.resolve(() => {});
      }),
    };
    const onBlur = vi.fn();
    await installBlurClear(mockWindow, onBlur);
    expect(capturedHandler).not.toBeNull();
    capturedHandler!({ payload: true });
    expect(onBlur).not.toHaveBeenCalled();
  });

  test("browser window.blur event → onBlur fires (defense-in-depth)", async () => {
    const mockWindow: FocusChangeableWindow = {
      onFocusChanged: vi.fn(() => Promise.resolve(() => {})),
    };
    const onBlur = vi.fn();
    await installBlurClear(mockWindow, onBlur);
    window.dispatchEvent(new Event("blur"));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test("callback never throws when onBlur throws", async () => {
    let capturedHandler: ((event: { payload: boolean }) => void) | null = null;
    const mockWindow: FocusChangeableWindow = {
      onFocusChanged: vi.fn((handler) => {
        capturedHandler = handler;
        return Promise.resolve(() => {});
      }),
    };
    const onBlur = vi.fn(() => {
      throw new Error("boom");
    });
    await installBlurClear(mockWindow, onBlur);
    // Tauri path should not throw
    expect(() => capturedHandler!({ payload: false })).not.toThrow();
    // Browser path should not throw
    expect(() => window.dispatchEvent(new Event("blur"))).not.toThrow();
  });

  test("returned cleanup tears down both Tauri and browser listeners", async () => {
    const mockUnlisten = vi.fn();
    let capturedHandler: ((event: { payload: boolean }) => void) | null = null;
    const mockWindow: FocusChangeableWindow = {
      onFocusChanged: vi.fn((handler) => {
        capturedHandler = handler;
        return Promise.resolve(mockUnlisten);
      }),
    };
    const onBlur = vi.fn();
    const cleanup = await installBlurClear(mockWindow, onBlur);

    // Call cleanup
    cleanup();

    // Tauri unlisten should have been called
    expect(mockUnlisten).toHaveBeenCalledTimes(1);

    // After cleanup, browser blur should NOT trigger onBlur
    onBlur.mockClear();
    window.dispatchEvent(new Event("blur"));
    expect(onBlur).not.toHaveBeenCalled();

    // After cleanup, Tauri payload should also not trigger (handler captured before cleanup)
    // The Tauri path is torn down via unlisten; capturedHandler still exists but
    // the listener is removed from the Tauri window — verified via mockUnlisten.
    void capturedHandler; // reference to avoid unused warning
  });
});
