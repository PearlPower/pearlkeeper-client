// apps/desktop/src/platform/idleLock.ts
//
// : idle auto-lock subscribes to lockStore.idleTimeoutMs.
// User-input events (mousemove/keydown/wheel/touchstart) reset the timer;
// changes to lockStore.idleTimeoutMs reinstall the timer with the new
// threshold; idleTimeoutMs === null (the "Never" Settings option) clears
// any pending timer and skips reinstallation. User-input listeners are
// registered once for app lifetime regardless of timeout value (cheap).
//
// On lock fire we call lockStore.getState().lock() inside try/catch — same
// defensive posture as installLockClear.ts (T-22-08) and lockOnClose.ts
// (T-20-12). A bad action handler must NEVER crash the timer chain.
//
// Event set: minimal `mousemove`, `keydown`, `wheel`, `touchstart` (Pattern
// S-6). Excluded: `scroll` (`wheel` covers desktop scroll wheel; trackpad
// scroll fires `wheel` too). `click` is implied by `mousemove` preceding
// it. `passive: true` keeps event handling off the rendering critical path.
//
// The legacy `IDLE_LOCK_MS = 15 * 60 * 1000` constant is REMOVED — its
// value moved into `createLockStore`'s default for `idleTimeoutMs` in
// (). Callers thread the lockStore reference directly.

import type { LockStore } from "@prl-wallet/app-state";

const EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove",
  "keydown",
  "wheel",
  "touchstart",
];

export function initIdleLock(lockStore: LockStore): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const onIdle = () => {
    try {
      lockStore.getState().lock();
    } catch {
      // Defensive — mirrors lockOnClose.ts T-20-12 / installLockClear.ts T-22-08.
    }
  };

  const reset = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    const ms = lockStore.getState().idleTimeoutMs;
    if (ms === null) return; // "Never" — no timer
    timeoutId = setTimeout(onIdle, ms);
  };

  // Register input listeners once, lifetime = app.
  for (const ev of EVENTS) {
    document.addEventListener(ev, reset, { passive: true });
  }

  // Subscribe to idleTimeoutMs changes; reinstall the timer when it flips.
  const unsubscribe = lockStore.subscribe((state, prev) => {
    if (state.idleTimeoutMs !== prev.idleTimeoutMs) {
      reset();
    }
  });

  reset(); // start the timer (or skip if null)

  return () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    for (const ev of EVENTS) {
      document.removeEventListener(ev, reset);
    }
    unsubscribe();
  };
}
