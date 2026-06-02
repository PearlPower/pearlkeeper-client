export interface InitializeSecurityStateOptions {
  setHasPIN: (value: boolean) => void;
  setHasPINLoaded: (value: boolean) => void;
  wipeIfNeeded: () => Promise<void>;
  loadPINHash: () => Promise<string | null>;
  logError?: (error: unknown) => void;
}

/**
 * Boot-time security initialization. Runs the first-boot wipe (if needed)
 * before reading the PIN hash so a v1.0 -> v1.1 upgrade never observes a
 * stale PIN against wiped wallet data. Wipe errors are logged but do not
 * prevent the PIN load — the app always reaches a deterministic pin-loaded
 * state so AppNavigator can route.
 *
 * `wipeIfNeeded` and `loadPINHash` are explicit required arguments (no
 * defaults) so this helper stays shared-package clean — the mobile app
 * wires performFirstBootWipeIfNeeded + getPINHash at the call site.
 */
export async function initializeSecurityState({
  setHasPIN,
  setHasPINLoaded,
  wipeIfNeeded,
  loadPINHash,
  logError,
}: InitializeSecurityStateOptions): Promise<void> {
  try {
    await wipeIfNeeded();
  } catch (error) {
    logError?.(error);
  }

  try {
    const hash = await loadPINHash();
    setHasPIN(hash !== null);
  } finally {
    setHasPINLoaded(true);
  }
}
