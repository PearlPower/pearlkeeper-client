// apps/desktop/src/screens/PIN/PINConfirmScreen.tsx
//
// ( + ) — PIN setup confirm step.
// Reads originalPin from useLocation().state.pin (set by PINCreate),
// verifies via byte-equality, then hashes and persists.
//
// Success path:
// confirmed === originalPin
// → produce Argon2id record via createPinRecord
// → await services.secrets.storePinHash(hash) ()
// → stores.pin.setHasPIN(true) ( store)
// → navigate('/wallet/new', { replace: true }) (T-20-17 mitigation)
// Mismatch path:
// → setError "Those PINs don't match. Start over." (UI-SPEC line 167)
// → trigger shake; clear local pin to enable retry
// Save error path:
// → setError "Could not save PIN. Please try again." (no toast — inline)
//
// T-20-17: { replace: true } on success means the create-route history entry
// is replaced once the auth-tree flips.
// T-20-18: PINGrid's submittedRef dedup + isSaving boolean guard prevent
// double-fire of storePinHash.
//
// If location state is missing or malformed (e.g., user lands here directly),
// useEffect redirects to /pin/create (replace:true so history isn't bloated).

import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { PINGrid } from "@/components/PINGrid";
import { createPinRecord } from "@/lib/hashPIN";
import { Button } from "@/components/ui/button";

export function PINConfirmScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const originalPin = (location.state as { pin?: string } | null)?.pin;
  const { services, stores } = useAdapters();
  const setHasPIN = useStore(stores.pin, (s) => s.setHasPIN);

  const [confirmed, setConfirmed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // IN-08: own the shake-reset timer so we can clear it on unmount and
  // avoid setShake(false) firing on a soon-to-be-unmounted component.
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

  // WR-05: render-time guard. If we landed here without a captured original
  // PIN (direct nav, hot reload that lost location.state, etc.), redirect at
  // render time via <Navigate> rather than from useEffect after first paint.
  // The effect-based version still painted the grid, accepted six digits,
  // and ran handleConfirm against `originalPin === undefined` — which a)
  // briefly flashed the mismatch error, and b) called setShake(true) on a
  // soon-to-be-unmounted component (StrictMode warns).
  //
  // The early return must come AFTER all hook calls so the call order stays
  // stable across renders (Rules of Hooks). The setState values are
  // discarded along with the unmounting component.
  if (!originalPin || originalPin.length !== 6) {
    return <Navigate to="/pin/create" replace />;
  }

  const handleConfirm = async (typed: string) => {
    if (typed !== originalPin) {
      setError("Those PINs don't match. Start over.");
      triggerShake();
      setConfirmed("");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const record = await createPinRecord(typed);
      await services.secrets.storePinHash(record);
      setHasPIN(true);
      // T-20-17: replace:true so the post-flip history doesn't point back
      // at the now-stale PIN ceremony.
      navigate("/wallet/new", { replace: true });
    } catch {
      setError("Could not save PIN. Please try again.");
      setIsSaving(false);
    }
  };

  return (
    <main className="bg-background min-h-screen flex items-center justify-center">
      <section className="max-w-md mx-auto px-6 py-8 w-full">
        <h1 className="text-xl font-semibold leading-snug mb-2 text-center">
          Confirm your PIN
        </h1>
        <p className="text-sm text-muted-foreground mb-12 text-center">
          Enter the same 6 digits again.
        </p>
        <div className="flex justify-center">
          <PINGrid
            value={confirmed}
            onChange={setConfirmed}
            onComplete={handleConfirm}
            shake={shake}
            disabled={isSaving}
            autoFocus
          />
        </div>
        {error && (
          <p className="text-sm text-destructive mt-4 text-center" role="alert">
            {error}
          </p>
        )}
        <Button
          variant="ghost"
          className="w-full mt-8"
          onClick={() => navigate("/pin/create", { replace: true })}
          disabled={isSaving}
        >
          Back
        </Button>
      </section>
    </main>
  );
}
