// apps/desktop/src/screens/PIN/PINUnlockScreen.tsx
//
// ( + ) — locked-state gate.
//
// Reads PIN, verifies via verifyPin against services.secrets.getPinHash() (Argon2id record).
// On mismatch: lockStore.recordFailedAttempt() — lockStore handles the
// 5/8/10 escalating cooldowns (verbatim from packages/app-state/src/lockStore.ts
// lines 34-49). On the 10th cumulative failed attempt, this screen owns the
// wipe trigger:
// await deleteAllSecrets({ secrets: services.secrets, wallets })
// for each wallet: removeWallet(w.id); setActiveWalletId(null)
// lockStore.resetAttempts() (clear lockUntil so next launch isn't stuck)
// navigate('/', { replace: true }) — auth state machine flips to Welcome
//
// MAX_ATTEMPTS = 10 is locked from lockStore's strictest cooldown level
// (packages/app-state/src/lockStore.ts line 40 — the >= 10 branch sets the
// 1-hour cooldown). Per "wipe on final attempt" + mobile parity,
// this is the wipe trigger threshold. DO NOT change to 5 or 8 — those are
// intermediate cooldown thresholds, not wipe thresholds.
//
// : NO biometric unlock on desktop. Tauri 2.10 has no stable biometric
// plugin and keyring@3.6 doesn't enable biometric-gated keychain access.
// PIN-only.
//
// Locked copy (UI-SPEC §PINUnlock, lines 174–178):
// H1: "Enter your PIN"
// Body: "Unlock to continue."
// Error: "Incorrect PIN. {N} attempts remaining."
// Lockout: "Too many attempts. Try again in {seconds}s."
// Final-attempt warning: "One attempt left. Wallets will be wiped after a
// failed entry."

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { deleteAllSecrets } from "@prl-wallet/services";
import { PINGrid } from "@/components/PINGrid";
import { verifyPin } from "@/lib/hashPIN";

// B-3 — verbatim from packages/app-state/src/lockStore.ts line 40 (the
// `>= 10` branch sets the 1-hour cooldown — the strictest level, which
// treats as the wipe trigger per "wipe on final attempt" +
// mobile parity).
const MAX_ATTEMPTS = 10;

export function PINUnlockScreen() {
  const navigate = useNavigate();
  const { services, stores } = useAdapters();
  const wallets = useStore(stores.walletList, (s) => s.wallets);
  const removeWallet = useStore(stores.walletList, (s) => s.removeWallet);
  const setActiveWalletId = useStore(
    stores.walletList,
    (s) => s.setActiveWalletId,
  );
  const lockUntil = useStore(stores.lock, (s) => s.lockUntil);
  const unlock = useStore(stores.lock, (s) => s.unlock);
  const recordFailedAttempt = useStore(
    stores.lock,
    (s) => s.recordFailedAttempt,
  );
  const resetAttempts = useStore(stores.lock, (s) => s.resetAttempts);

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // IN-08: own the shake-reset timer so we can clear it on unmount. The
  // wipe path navigates away ~immediately after the 10th wrong PIN; without
  // this cleanup the queued setShake(false) fires on the unmounted screen
  // (React 19 silently ignores cross-component setters — purely a leak,
  // but trivial to fix).
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    },
    [],
  );
  const triggerShake = () => {
    setShake(true);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    // 350ms shake animation + 10ms buffer (matches @keyframes shake).
    shakeTimerRef.current = setTimeout(() => setShake(false), 360);
  };

  // Tick the clock every 1s while a lockout is active so the countdown
  // copy stays current. WR-01: deps are `[lockUntil]` only — including `now`
  // would tear down and recreate the interval on every tick (the ticker
  // itself updates `now`), which is wasteful and obscures the contract.
  // The interval only needs to be (re)installed when `lockUntil` changes.
  useEffect(() => {
    if (!lockUntil) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      // Stop the interval as soon as the cooldown expires so we don't keep
      // ticking forever on a stale `lockUntil`.
      if (t >= lockUntil) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  const isLockedOut = lockUntil !== null && lockUntil > now;
  const secondsRemaining = isLockedOut
    ? Math.ceil((lockUntil! - now) / 1000)
    : 0;

  const handleWipeAndReset = useCallback(async () => {
    try {
      await deleteAllSecrets({ secrets: services.secrets, wallets });
    } catch {
      // Best effort — keychain may be partially gone already (T-20-19
      // guarantees the helper iterates the hydrated wallet list AND
      // deletes the global PIN hash; per-wallet errors are swallowed
      // inside the helper itself).
    }
    for (const w of wallets) {
      removeWallet(w.id);
    }
    setActiveWalletId(null);
    // Clear lockUntil so the next launch isn't stuck behind a stale
    // 1-hour cooldown when the user returns to the freshly-empty Welcome
    // screen.
    resetAttempts();
    // WR-03: leave the in-memory stores in a self-consistent "first launch"
    // state. Without these two calls the post-wipe state is
    // hasWallet=false, hasPIN=true, isLocked=true
    // and the auth state machine in App.tsx only routes to Welcome by virtue
    // of the `!hasWallet || !hasPIN` short-circuit being evaluated first. If
    // that ordering ever changes (e.g. someone gates first-launch on
    // `!hasPIN` only), the user could be funnelled directly back into the
    // locked tree on a freshly-wiped install. Defense-in-depth: clear both
    // hasPIN and isLocked so the post-wipe state is unambiguous.
    stores.pin.getState().setHasPIN(false);
    stores.lock.getState().unlock();
    navigate("/", { replace: true });
  }, [
    services.secrets,
    wallets,
    removeWallet,
    setActiveWalletId,
    resetAttempts,
    stores.pin,
    stores.lock,
    navigate,
  ]);

  const handleComplete = async (typed: string) => {
    if (isLockedOut) return;
    const stored = await services.secrets.getPinHash();
    if (stored !== null && (await verifyPin(typed, stored))) {
      unlock();
      setError(null);
      return;
    }
    recordFailedAttempt();
    triggerShake();
    setPin("");

    // WR-02: read the post-update counter from the canonical store rather
    // than the render-time closure. Two failure modes the closure version
    // suffers from:
    // 1) If a second submission lands before React flushes the re-render
    // following the first recordFailedAttempt(), both handlers compute
    // `newFailedAttempts` from the same stale base and undercount.
    // 2) The local arithmetic duplicates lockStore's counter and is
    // guaranteed to drift if any other surface ever calls
    // recordFailedAttempt().
    const newFailedAttempts = stores.lock.getState().failedAttempts;
    // B-3: wipe trigger fires on the 10th cumulative failed attempt — the
    // strictest lockStore cooldown level. The wipe responsibility lives
    // here in PINUnlockScreen (lockStore itself does NOT auto-wipe).
    if (newFailedAttempts >= MAX_ATTEMPTS) {
      await handleWipeAndReset();
      return;
    }
    if (newFailedAttempts === MAX_ATTEMPTS - 1) {
      setError("One attempt left. Wallets will be wiped after a failed entry.");
    } else {
      setError(
        `Incorrect PIN. ${MAX_ATTEMPTS - newFailedAttempts} attempts remaining.`,
      );
    }
  };

  return (
    <main className="bg-background min-h-screen flex items-center justify-center">
      <section className="max-w-md mx-auto px-6 py-8 w-full">
        <h1 className="text-xl font-semibold leading-snug mb-2 text-center">
          Enter your PIN
        </h1>
        <p className="text-sm text-muted-foreground mb-12 text-center">
          Unlock to continue.
        </p>
        <div className="flex justify-center">
          <PINGrid
            value={pin}
            onChange={setPin}
            onComplete={handleComplete}
            shake={shake}
            disabled={isLockedOut}
            autoFocus
          />
        </div>
        {isLockedOut && (
          <p
            className="text-sm text-destructive mt-4 text-center"
            role="alert"
            aria-live="polite"
          >
            Too many attempts. Try again in {secondsRemaining}s.
          </p>
        )}
        {!isLockedOut && error && (
          <p className="text-sm text-destructive mt-4 text-center" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
