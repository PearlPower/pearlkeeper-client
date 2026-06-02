// apps/desktop/src/platform/lockOnClose.ts
//
// close-on-request handler installation. Extracted from main.tsx so
// can unit-test the registration contract by mocking
// currentWindow.onCloseRequested. The handler MUST never throw — a thrown
// exception inside a Tauri close handler can block OS exit (T-20-12).

import type { AdaptersBundle } from "@prl-wallet/app-adapters";

// Minimal structural type — matches @tauri-apps/api/window's Window#onCloseRequested.
// We avoid importing the concrete `Window` type so this module stays Tauri-version-agnostic
// and trivially mockable. 's lockOnClose.test.ts substitutes a stub object that
// matches this shape.
type UnlistenFn = () => void;
export interface CloseRequestableWindow {
  onCloseRequested(handler: () => void): Promise<UnlistenFn>;
}

/**
 * Install a Tauri close-requested handler that locks the wallet bundle
 * before window unmount. Returns the underlying unlisten promise so callers
 * can `await` it during shutdown if they need to.
 *
 * The handler is wrapped in try/catch to satisfy T-20-12 — Tauri's close
 * pipeline must never see an exception escape this callback. Note we do
 * NOT block the close — let it proceed (Pattern S-6 / RESEARCH.md Pattern 5).
 */
export function installCloseLock(
  bundle: AdaptersBundle,
  currentWindow: CloseRequestableWindow,
): Promise<UnlistenFn> {
  return currentWindow.onCloseRequested(() => {
    try {
      bundle.stores.lock.getState().lock();
    } catch {
      // Never throw from a close handler — would block OS exit (Pattern S-6).
    }
  });
}
