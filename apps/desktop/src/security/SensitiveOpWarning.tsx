// apps/desktop/src/security/SensitiveOpWarning.tsx
//
// / — single shape, per-op copy from SENSITIVE_OP_COPY.
// Body layout branches on copy.tier:
// "type-to-confirm" → Input + locked mismatch (copy.confirmMismatch) + 3 buttons (Cancel / Continue / Turn off network first)
// "explain" → 2 buttons (Cancel / Continue anyway). No Input. No "Turn off network first".
// (): aligned SignTx UX with — broadcast is
// an explanation, not a high-friction reveal. Mismatch text moved from inline literal
// to SENSITIVE_OP_COPY[op].confirmMismatch so the catalog test owns all per-op copy.

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SENSITIVE_OP_COPY, type SensitiveOp } from "./sensitiveOps";

export interface SensitiveOpWarningProps {
  op: SensitiveOp;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
}

export function SensitiveOpWarning({
  op,
  open,
  onOpenChange,
  onConfirm,
}: SensitiveOpWarningProps) {
  const { stores } = useAdapters();
  const isOpen = useStore(stores.networkGate, (s) => s.isOpen);

  const [confirmText, setConfirmText] = useState("");

  const copy = SENSITIVE_OP_COPY[op];
  const requiresPhrase = copy.tier === "type-to-confirm";
  const canConfirm = !requiresPhrase || confirmText === copy.confirmPhrase;

  // Reset-on-close: mirrors DangerZone.tsx:91-93 (Pitfall 5)
  const handleOpenChange = (o: boolean) => {
    if (!o) setConfirmText("");
    onOpenChange(o);
  };

  // Auto-dismiss on external gate close (RESEARCH Open Question 2 resolution — T-22-20)
  useEffect(() => {
    if (open && !isOpen) {
      onOpenChange(false);
    }
  }, [open, isOpen, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ShieldAlert aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.bodyHeadline}</AlertDialogDescription>
          <ul className="text-sm text-muted-foreground list-disc list-inside mt-1 space-y-1">
            {copy.riskBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </AlertDialogHeader>
        {requiresPhrase && (
          <div className="grid gap-2">
            <Label htmlFor="confirm-phrase">
              Type {copy.confirmPhrase} to continue
            </Label>
            <Input
              id="confirm-phrase"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoFocus
              className="font-mono"
              aria-label="Type SHOW MY SEED to continue"
            />
            {confirmText.length > 0 && confirmText !== copy.confirmPhrase && copy.confirmMismatch && (
              <p className="text-destructive text-xs mt-2">
                {copy.confirmMismatch}
              </p>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost">
            {copy.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={requiresPhrase && !canConfirm}
            onClick={onConfirm}
          >
            {copy.continueAnywayLabel}
          </AlertDialogAction>
          {requiresPhrase && (
            <AlertDialogAction
              variant="default"
              onClick={() => {
                stores.networkGate.getState().close();
                onOpenChange(false);
              }}
            >
              {copy.primaryCtaLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
