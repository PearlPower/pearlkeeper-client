// apps/desktop/src/screens/WalletDetail/components/DangerZone.tsx
//
// type-name confirm AlertDialog + Danger zone card.
//
// The dialog open is the FIRST confirmation step; the typed-name match enabling
// the Delete button is the SECOND. Per OPS-07: deleteWalletSecrets wipes only
// this wallet's keychain entries (); other wallets untouched.
//
// Locked copy (UI-SPEC §"Type-name Delete" lines 339-346 + §WalletDetail
// "Danger zone" rows 210-212 — DO NOT paraphrase):
// "Danger zone" /
// "Permanently delete this wallet and wipe its OS keychain entries." /
// "Delete wallet" / "Permanently delete wallet?" /
// "This will wipe '{walletName}' from the OS keychain. ..." /
// "Type the wallet name to confirm:" / "Cancel" / "Delete forever" /
// "Wallet deleted" (toast) / "Could not delete wallet. Try again." (error toast)
//
// Threat mitigations:
// T-20-31: AlertDialogAction is `disabled={!canConfirm}` — Radix does NOT
// auto-submit on Enter, but the disabled flag is a safety belt.
// T-20-33: isDeleting boolean disables the button so a double-click is a no-op.
// confirmText === walletName is case-sensitive ( explicit).
// onOpenChange resets confirmText to "" on close → no stale state if the
// user re-opens (mobile parity gotcha — Pattern 8 lines 646-651).
// Destructive styling applied via className, NOT a `variant` prop on
// AlertDialogAction (which DOES accept a variant prop on this codebase's
// shadcn build, but the canonical sketch in PATTERNS.md uses className —
// stick with className for portability).

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DangerZoneProps {
  walletId: string;
  walletName: string;
}

export function DangerZone({ walletId, walletName }: DangerZoneProps) {
  const navigate = useNavigate();
  const { services, stores } = useAdapters();
  const removeWallet = useStore(stores.walletList, (s) => s.removeWallet);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // : case-sensitive exact match. The walletName comparison + the !isDeleting
  // guard together implement T-20-31 + T-20-33 (no double-fire, no Enter auto-submit).
  const canConfirm = confirmText === walletName && !isDeleting;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // : deleteWalletSecrets walks the four fixed per-wallet
      // suffixes (mnemonic, bip32seed, xpub, walletType) and is idempotent —
      // delete-non-existent is a no-op.
      await services.secrets.deleteWalletSecrets(walletId);
      removeWallet(walletId);
      toast("Wallet deleted");
      navigate("/wallets");
    } catch {
      toast.error("Could not delete wallet. Try again.");
      setIsDeleting(false);
    }
  };

  return (
    <section className="border border-destructive rounded-md p-6 mt-8">
      <h2 className="text-xs text-destructive font-semibold uppercase tracking-wide">
        Danger zone
      </h2>
      <p className="text-xs text-muted-foreground mt-2">
        Permanently delete this wallet and wipe its OS keychain entries.
      </p>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirmText("");
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="mt-4">
            Delete wallet
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will wipe &apos;{walletName}&apos; from the OS keychain.
              Without your seed phrase you cannot recover it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="confirm-name">
              Type the wallet name to confirm:
            </Label>
            <Input
              id="confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
