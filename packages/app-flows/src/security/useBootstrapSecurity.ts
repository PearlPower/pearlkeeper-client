// packages/app-flows/src/security/useBootstrapSecurity.ts
//
// ( / ) — shared boot-time security hook.
// Wraps the existing `initializeSecurityState` helper so both apps share
// one PIN-load path. Mobile's BootHydrator useEffect (apps/mobile/App.tsx:89-99)
// is migrated to consume this hook in Wave 4.
//
// Design:
// `useAdapters()` provides services.secrets (the WalletSecretsPort)
// and stores.pin (the pinStore). The hook reads both and wires
// initializeSecurityState's I/O to them.
// `wipeIfNeeded` is OPTIONAL because desktop has no v1.0 → v1.1
// migration semantic; mobile passes its `wipeFirstBootIfNeeded`.
// Default: no-op (RESEARCH.md Open Question #1).
// The effect runs once per <HydrationGate> mount. Re-invocations
// (e.g., on dev hot-reload) are idempotent: setHasPINLoaded(true)
// stays true, setHasPIN(...) re-evaluates against the same PIN hash.

import { useEffect } from "react";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { initializeSecurityState } from "../flows/bootstrapSecurity.js";

export interface UseBootstrapSecurityOptions {
  /**
   * App-supplied first-boot wipe (mobile passes performFirstBootWipeIfNeeded;
   * desktop omits — defaults to no-op).
   */
  wipeIfNeeded?: () => Promise<void>;
  /** Defaults to console.error; tests can pass jest.fn() / vi.fn() to silence. */
  logError?: (error: unknown) => void;
}

const NOOP_WIPE = async (): Promise<void> => {
  /* no-op: desktop has no first-boot wipe semantic in v1.3 (RESEARCH.md OQ#1) */
};

/**
 * Mount once at boot (typically inside <HydrationGate> on desktop, or
 * a sibling <BootstrapEffects> on mobile). Sets pinStore.hasPIN +
 * pinStore.hasPINLoaded based on whether `secrets.getPinHash()` returns
 * non-null.
 */
export function useBootstrapSecurity(
  options?: UseBootstrapSecurityOptions,
): void {
  const { services, stores } = useAdapters();
  const setHasPIN = useStore(stores.pin, (s) => s.setHasPIN);
  const setHasPINLoaded = useStore(stores.pin, (s) => s.setHasPINLoaded);
  const wipeIfNeeded = options?.wipeIfNeeded ?? NOOP_WIPE;
  const logError = options?.logError ?? console.error;

  useEffect(() => {
    void initializeSecurityState({
      setHasPIN,
      setHasPINLoaded,
      wipeIfNeeded,
      loadPINHash: () => services.secrets.getPinHash(),
      logError,
    });
    // Dependencies: services.secrets (changes when AdaptersBundle is
    // rebuilt — e.g., on KeychainUnavailableScreen [Retry] success).
    // setHasPIN/setHasPINLoaded are zustand setters, identity-stable.
  }, [services, setHasPIN, setHasPINLoaded, wipeIfNeeded, logError]);
}
