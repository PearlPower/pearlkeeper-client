// apps/desktop/src/security/RePinDialog.tsx
//
// / — re-PIN dialog reused inside <SensitiveOpGate>.
// Reuses PINUnlockScreen's PIN match path verbatim; shares lockStore.recordFailedAttempt
// counter with PINUnlockScreen so the global 5/8/10 escalation still applies. AlertDialog
// shell + reset-on-close (Pitfall 5) mirror DangerZone.tsx:90-131.

import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PINGrid } from "@/components/PINGrid";
import { verifyPin } from "@/lib/hashPIN";

export interface RePinDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMatch: () => void;
}

export function RePinDialog({ open, onOpenChange, onMatch }: RePinDialogProps) {
  const { services, stores } = useAdapters();
  const recordFailedAttempt = useStore(
    stores.lock,
    (s) => s.recordFailedAttempt,
  );

  const [pin, setPin] = useState("");
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [shake, setShake] = useState(false);

  // IN-08: shake-reset timer cleanup on unmount — mirrors PINUnlockScreen.tsx:74-86
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
    // 350ms shake animation + 10ms buffer (matches @keyframes shake)
    shakeTimerRef.current = setTimeout(() => setShake(false), 360);
  };

  // PIN match path — verbatim from PINUnlockScreen.tsx:150-186
  const handleComplete = async (typed: string) => {
    const stored = await services.secrets.getPinHash();
    if (stored !== null && (await verifyPin(typed, stored))) {
      onMatch();
      setPin("");
      return;
    }
    // Mismatch: record against the shared lockStore counter ( escalation)
    recordFailedAttempt();
    triggerShake();
    setPin("");

    // : local 3-wrong-attempts counter — separate from lockStore.failedAttempts.
    // After the 3rd wrong attempt within this dialog session, close the dialog.
    // Use functional updater to avoid stale closure (mirrors WR-02 pattern from PINUnlockScreen).
    setWrongAttempts((n) => {
      const next = n + 1;
      if (next >= 3) {
        // Close without unlocking — lockStore counter still escalates ()
        onOpenChange(false);
      }
      return next;
    });
  };

  // Reset-on-close: mirrors DangerZone.tsx:91-93 (Pitfall 5)
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setPin("");
      setWrongAttempts(0);
    }
    onOpenChange(o);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enter PIN to reveal seed phrase</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex justify-center py-2">
          <PINGrid
            value={pin}
            onChange={setPin}
            onComplete={handleComplete}
            shake={shake}
            disabled={false}
            autoFocus
          />
        </div>
        {wrongAttempts > 0 && wrongAttempts < 3 && (
          <p className="text-destructive text-xs mt-2 text-center">
            Incorrect PIN
          </p>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
