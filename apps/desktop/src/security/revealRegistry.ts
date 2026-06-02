// apps/desktop/src/security/revealRegistry.ts
//
// module-scope registry of reveal-clear callbacks.
// Mirrors `apps/desktop/src/platform/idleLock.ts` listener-set shape. Used by
// `installBlurClear` + `installLockClear` to clear every visible secret on focus loss
// or auto-lock.

type ClearCallback = () => void;
const callbacks = new Set<ClearCallback>();

export function register(cb: ClearCallback): () => void {
  callbacks.add(cb);
  return () => {
    callbacks.delete(cb);
  };
}

export function clearAll(): void {
  for (const cb of callbacks) {
    try {
      cb();
    } catch {
      /* never let one bad callback abort the rest */
    }
  }
}
