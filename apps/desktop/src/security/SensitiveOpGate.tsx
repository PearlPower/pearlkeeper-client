// apps/desktop/src/security/SensitiveOpGate.tsx
//
// / — render-prop sensitive-op gate.
// Render-prop chosen over wrapper-button per RESEARCH Pattern 4 (preserves
// wrap-not-rewrite composability with HoldToReveal and standard <Button>).
// State machine sequences re-PIN and warning so dialogs never stack ().
//
// 2026-05-08 update — type-to-confirm tier ops (reveal_mnemonic + 3 deferred)
// no longer trigger the SensitiveOpWarning step online. PIN is the sole gate
// for those ops; the catalog tier metadata is preserved for the
// SensitiveOpWarning render branch (still used if a future surface opts in)
// and for catalog tests. The "explain" tier (sign_tx) keeps its broadcast
// warning when online, unchanged.

import { useCallback, useRef, useState, type ReactNode, type JSX } from "react";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { RePinDialog } from "./RePinDialog";
import { SensitiveOpWarning } from "./SensitiveOpWarning";
import { SENSITIVE_OP_COPY, type SensitiveOp } from "./sensitiveOps";

export interface SensitiveOpGateProps {
  op: SensitiveOp;
  onConfirm: () => void;
  /** Optional. Fires when the state machine returns to "idle" from "rePin" or "warning"
   * without onConfirm having fired (i.e. user dismissed any dialog). 's
   * SeedPhraseScreen consumer uses this to resolve a pending gate Promise with `false`
   * so the awaiting HoldToReveal does not hang. Safe no-op if omitted. */
  onCancel?: () => void;
  children: (trigger: () => void) => ReactNode;
}

type GateStep = "idle" | "rePin" | "warning";

export function SensitiveOpGate({
  op,
  onConfirm,
  onCancel,
  children,
}: SensitiveOpGateProps): JSX.Element {
  const { stores } = useAdapters();
  const isOpen = useStore(stores.networkGate, (s) => s.isOpen);

  const [step, setStep] = useState<GateStep>("idle");

  // confirmedRef: set true when onConfirm path fires; reset false on each trigger().
  // Ensures onCancel fires exactly once per cancellation, never alongside onConfirm.
  const confirmedRef = useRef(false);

  const trigger = useCallback(() => {
    confirmedRef.current = false;
    setStep("rePin");
  }, []);

  // Called when RePinDialog reports a correct PIN.
  // Warning step only shown when (a) online AND (b) op is "explain" tier.
  // type-to-confirm tier ops (reveal_mnemonic etc.) skip the warning — PIN suffices.
  const onPinMatch = useCallback(() => {
    const tier = SENSITIVE_OP_COPY[op].tier;
    if (isOpen && tier === "explain") {
      // Online + explain tier: defer state transition one frame to avoid Radix exit
      // animation overlap (Pitfall 3 — gives re-PIN dialog one frame to start exit).
      requestAnimationFrame(() => setStep("warning"));
    } else {
      // Offline OR type-to-confirm tier: skip warning entirely, proceed directly.
      confirmedRef.current = true;
      setStep("idle");
      onConfirm();
    }
  }, [isOpen, onConfirm, op]);

  // Called when SensitiveOpWarning "Continue anyway" is clicked
  const onWarningConfirm = useCallback(() => {
    confirmedRef.current = true;
    setStep("idle");
    onConfirm();
  }, [onConfirm]);

  return (
    <>
      {children(trigger)}
      <RePinDialog
        open={step === "rePin"}
        onOpenChange={(o) => {
          if (!o) {
            setStep("idle");
            if (!confirmedRef.current) onCancel?.();
          }
        }}
        onMatch={onPinMatch}
      />
      <SensitiveOpWarning
        op={op}
        open={step === "warning"}
        onOpenChange={(o) => {
          if (!o) {
            setStep("idle");
            if (!confirmedRef.current) onCancel?.();
          }
        }}
        onConfirm={onWarningConfirm}
      />
    </>
  );
}
