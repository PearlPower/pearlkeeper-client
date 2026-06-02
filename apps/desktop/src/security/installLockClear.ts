// apps/desktop/src/security/installLockClear.ts
//
// boot-init lockStore subscription. Mirrors
// `apps/desktop/src/platform/networkGate.ts:30-45` prev/next compare pattern. Fires
// only on isLocked false → true transition (Pitfall 2 — Zustand subscribe does NOT
// fire on initial subscription, but the prev/next compare is defense-in-depth).

import type { LockStore } from "@prl-wallet/app-state";

/**
 * Subscribe to lockStore and invoke onLock whenever the wallet transitions
 * from unlocked (isLocked: false) to locked (isLocked: true).
 *
 * Does NOT use subscribeWithSelector middleware — plain subscribe with
 * prev/next compare (Pitfall 2 mitigation: initial subscription does not fire).
 *
 * Returns the Zustand unsubscribe function.
 */
export function installLockClear(
  lockStore: LockStore,
  onLock: () => void,
): () => void {
  return lockStore.subscribe((state, prev) => {
    if (state.isLocked && !prev.isLocked) {
      try {
        onLock();
      } catch {
        // Never let a bad onLock callback propagate up through the Zustand
        // subscriber chain (T-22-08 / mirrors clearAll try/catch pattern).
      }
    }
  });
}
