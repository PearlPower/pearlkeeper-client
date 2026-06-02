// packages/app-state/src/lockStore.ts
//
// () — lockStore factory now accepts a StoragePort and persists
// `idleTimeoutMs` (number | null, default 15 * 60 * 1000 = 900000) under
// top-level key 'prl-lock-store'. `null` represents the "Never" auto-lock
// option ( / ).
//
// Persistence discipline (T-23-01): partialize selects ONLY `idleTimeoutMs`.
// Session-scoped state (`isLocked`, `failedAttempts`, `lockUntil`) is NEVER
// persisted — `isLocked: true` boot default prevents content flash before
// authentication, and a tampered storage write cannot pre-set the unlocked
// state to bypass the lock screen.
//
// Escalating lockout math (5/8/10 failed attempts) is preserved verbatim
// from the prior factory.
//
// Mirrors the persist+partialize+createJSONStorage shape established by
// networkGateStore.ts in .

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StoragePort } from "./storagePort.js";

export interface LockState {
  isLocked: boolean;
  failedAttempts: number;
  lockUntil: number | null;
  /**
   * Idle auto-lock timeout in milliseconds, or `null` for "Never".
   * Default: `15 * 60 * 1000` (matches the legacy `IDLE_LOCK_MS` constant).
   * Persisted via `partialize` — the only field that survives storage round-trips.
   */
  idleTimeoutMs: number | null;
  lock: () => void;
  unlock: () => void;
  recordFailedAttempt: () => void;
  resetAttempts: () => void;
  setIdleTimeoutMs: (ms: number | null) => void;
}

/**
 * Factory for the lock-state Zustand store.
 * isLocked starts true — prevents any content flash before authentication.
 * Escalating lockout math (5/8/10 failed attempts) is preserved verbatim from
 * the mobile singleton.
 *
 * : now accepts a StoragePort and persists `idleTimeoutMs` only.
 */
export function createLockStore(storage: StoragePort) {
  return create<LockState>()(
    persist(
      (set, get) => ({
        isLocked: true,
        failedAttempts: 0,
        lockUntil: null,
        idleTimeoutMs: 15 * 60 * 1000,

        lock: () => set({ isLocked: true }),

        unlock: () =>
          set({
            isLocked: false,
            failedAttempts: 0,
            lockUntil: null,
          }),

        recordFailedAttempt: () => {
          const { failedAttempts } = get();
          const newAttempts = failedAttempts + 1;

          // Escalating lockout: 5 attempts → 30s, 8 attempts → 5 min, 10 attempts → 1 hr
          let lockUntil: number | null = null;
          if (newAttempts >= 10) {
            lockUntil = Date.now() + 60 * 60 * 1000; // 1 hour
          } else if (newAttempts >= 8) {
            lockUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
          } else if (newAttempts >= 5) {
            lockUntil = Date.now() + 30 * 1000; // 30 seconds
          }

          set({ failedAttempts: newAttempts, lockUntil });
        },

        resetAttempts: () => set({ failedAttempts: 0, lockUntil: null }),

        setIdleTimeoutMs: (ms) => set({ idleTimeoutMs: ms }),
      }),
      {
        name: "prl-lock-store",
        storage: createJSONStorage(() => storage),
        // T-23-01: ONLY the user-controlled idleTimeoutMs is persisted.
        // Session state (isLocked, failedAttempts, lockUntil) MUST stay
        // out of storage — a tampered write cannot bypass the lock screen.
        partialize: (state) => ({ idleTimeoutMs: state.idleTimeoutMs }),
      },
    ),
  );
}

export type LockStore = ReturnType<typeof createLockStore>;
