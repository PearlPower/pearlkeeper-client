// apps/desktop/src/security/installBlurClear.ts
//
// boot-init blur listener. Mirrors
// `apps/desktop/src/platform/lockOnClose.ts` (mockable Tauri-window shim) +
// `apps/desktop/src/platform/idleLock.ts` (boot-init lifetime). Listener is never
// torn down — lifetime = app lifetime. Reference: Tauri Issue #12747 — Linux blur
// bug requires `data-tauri-drag-region`, which this codebase does not use.

// Minimal structural type — matches @tauri-apps/api/window's Window#onFocusChanged.
// We avoid importing the concrete `Window` type so this module stays Tauri-version-agnostic
// and trivially mockable. Test code substitutes a stub object that matches this shape.
type UnlistenFn = () => void;

export interface FocusChangeableWindow {
  onFocusChanged(
    handler: (event: { payload: boolean }) => void,
  ): Promise<UnlistenFn>;
}

/**
 * Install a dual-path blur listener that fires onBlur when the window loses focus.
 *
 * Path 1 (primary): Tauri OS-level focus change via currentWindow.onFocusChanged.
 * Fires onBlur when event.payload === false (window unfocused).
 *
 * Path 2 (defense-in-depth): browser window "blur" event as a fallback.
 *
 * The handler is wrapped in try/catch to satisfy T-22-09 — a throwing callback
 * must never block the Tauri OS event pipeline (mirrors lockOnClose.ts:32-38).
 *
 * Returns a cleanup function that tears down both listeners.
 */
export async function installBlurClear(
  currentWindow: FocusChangeableWindow,
  onBlur: () => void,
): Promise<() => void> {
  // Path 1: Tauri onFocusChanged — fires on OS-level focus change
  const unlisten = await currentWindow.onFocusChanged((event) => {
    try {
      if (!event.payload) onBlur();
    } catch {
      // Never let a bad onBlur callback block the Tauri event pipeline (T-22-09).
    }
  });

  // Path 2: browser "blur" event — defense-in-depth for environments where
  // the Tauri path may not fire (e.g., some Linux configurations).
  const handleBrowserBlur = () => {
    try {
      onBlur();
    } catch {
      // Never let a bad onBlur callback escape.
    }
  };
  window.addEventListener("blur", handleBrowserBlur);

  return () => {
    unlisten();
    window.removeEventListener("blur", handleBrowserBlur);
  };
}
