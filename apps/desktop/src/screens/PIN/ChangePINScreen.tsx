// apps/desktop/src/screens/PIN/ChangePINScreen.tsx
//
// () — 3-step Change PIN wizard inside a single route.
//
// Step 1 "verify": call services.secrets.getPinHash(), compare to
// verifyPin(typedPin, stored). Mismatch → setError "That's not your current PIN."
// + shake. Match → step "enter-new". (T-20-23: only on byte-equal hash
// match does the wizard advance; no privilege escalation possible.)
// Step 2 "enter-new": store typed PIN locally, advance to "confirm-new".
// Step 3 "confirm-new": mismatch → setError "PINs do not match. Start
// over." + shake + reset to "enter-new" with cleared inputs. Match →
// await services.secrets.storePinHash(await createPinRecord(typed)) + toast("PIN
// updated") + navigate('/settings', { replace: true }).
//
// Cancel → navigate('/settings'). NO lockStore here: ChangePIN's verify
// step does NOT count as a lockout-triggering event (mobile parity; the
// lockout policy applies only to the unlock gate).
//
// Locked copy (UI-SPEC §ChangePIN, lines 327–334):
// Step 1 H1: "Enter your current PIN"
// Step 1 mismatch: "That's not your current PIN."
// Step 2 H1: "Enter your new PIN"
// Step 3 H1: "Confirm your new PIN"
// Step 3 mismatch: "PINs do not match. Start over."
// Success toast: "PIN updated"
// Cancel CTA: "Cancel"

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useAnalyticsFlow } from "@prl-wallet/app-flows";
import { toast } from "sonner";
import { PINGrid } from "@/components/PINGrid";
import { createPinRecord, verifyPin } from "@/lib/hashPIN";
import { Button } from "@/components/ui/button";
import { NOOP_ANALYTICS_PORT } from "@/lib/noopAnalyticsPort";

type Step = "verify" | "enter-new" | "confirm-new";

export function ChangePINScreen() {
  const navigate = useNavigate();
  const { services } = useAdapters();
  const [step, setStep] = useState<Step>("verify");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // pin.change flow. start on mount; success on
  // confirm + storage save; error on mismatch / storage failure.
  const analyticsFlow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "pin.change",
  );
  const flowStartedRef = useRef(false);
  useEffect(() => {
    if (flowStartedRef.current) return;
    flowStartedRef.current = true;
    analyticsFlow.start();
  }, [analyticsFlow]);

  // IN-08: own the shake-reset timer so we can clear it on unmount (e.g.
  // user clicks Cancel mid-shake → setShake(false) fires on the unmounted
  // screen otherwise — silent in React 19 but a tiny resource leak).
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

  const handleVerify = async (typed: string) => {
    const stored = await services.secrets.getPinHash();
    if (stored && (await verifyPin(typed, stored))) {
      setError(null);
      setPin("");
      setStep("enter-new");
    } else {
      setError("That's not your current PIN.");
      triggerShake();
      setPin("");
      // wrong current PIN is a flow error path.
      analyticsFlow.error();
    }
  };

  const handleEnterNew = (typed: string) => {
    setNewPin(typed);
    setPin("");
    setError(null);
    setStep("confirm-new");
  };

  const handleConfirmNew = async (typed: string) => {
    if (typed !== newPin) {
      setError("PINs do not match. Start over.");
      triggerShake();
      setPin("");
      setNewPin("");
      setStep("enter-new");
      // mismatch is a flow error.
      analyticsFlow.error();
      return;
    }
    setIsSaving(true);
    try {
      await services.secrets.storePinHash(await createPinRecord(typed));
      // successful PIN save = pin.change success.
      analyticsFlow.success();
      toast("PIN updated");
      navigate("/settings", { replace: true });
    } catch {
      setError("Could not save PIN. Please try again.");
      setIsSaving(false);
      // storage failure is a flow error.
      analyticsFlow.error();
    }
  };

  const heading =
    step === "verify"
      ? "Enter your current PIN"
      : step === "enter-new"
        ? "Enter your new PIN"
        : "Confirm your new PIN";

  const onComplete =
    step === "verify"
      ? handleVerify
      : step === "enter-new"
        ? handleEnterNew
        : handleConfirmNew;

  return (
    <main className="bg-background min-h-screen flex items-center justify-center">
      <section className="max-w-md mx-auto px-6 py-8 w-full">
        <h1 className="text-xl font-semibold leading-snug mb-12 text-center">
          {heading}
        </h1>
        <div className="flex justify-center">
          <PINGrid
            value={pin}
            onChange={setPin}
            onComplete={onComplete}
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
          onClick={() => navigate(1)}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </section>
    </main>
  );
}
