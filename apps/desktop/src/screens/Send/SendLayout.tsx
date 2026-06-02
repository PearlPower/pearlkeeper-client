// apps/desktop/src/screens/Send/SendLayout.tsx
// wizard layout-route element. Mounts the SendFlowProvider
// and renders chrome (top-bar with Back + Step pill + X-close + Esc handler
// + Discard AlertDialog) around the child Outlet.
//
// Two-component pattern: SendLayout mounts SendFlowProvider so that the inner
// SendChrome component can call useSendFlow() inside the Provider boundary.
// The Esc key listener lives in SendChrome where the Provider context is available.

import { useCallback, useEffect, useState } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SendFlowProvider, useSendFlow } from "./SendFlowProvider";

export function SendLayout() {
  const { id } = useParams<{ id: string }>();
  return (
    <SendFlowProvider walletId={id ?? ""}>
      <SendChrome />
    </SendFlowProvider>
  );
}

function computeStepPill(pathname: string): string | null {
  if (pathname.endsWith("/address")) return "Step 1 of 4 · Address";
  if (pathname.endsWith("/amount")) return "Step 2 of 4 · Amount";
  if (pathname.endsWith("/fee")) return "Step 3 of 4 · Fee";
  if (pathname.endsWith("/review")) return "Step 4 of 4 · Review";
  return null;
}

function SendChrome() {
  const navigate = useNavigate();
  const location = useLocation();
  const flow = useSendFlow();
  const [discardOpen, setDiscardOpen] = useState(false);

  const isDirty = flow.recipientAddress !== "" || flow.amountSats > 0n;
  const stepPillCopy = computeStepPill(location.pathname);

  const tryClose = useCallback(() => {
    if (isDirty) {
      setDiscardOpen(true);
    } else {
      navigate(`/wallet/${flow.walletId}`);
    }
  }, [isDirty, navigate, flow.walletId]);

  const confirmDiscard = useCallback(() => {
    setDiscardOpen(false);
    navigate(`/wallet/${flow.walletId}`);
  }, [navigate, flow.walletId]);

  // Esc keyboard listener (verbatim pattern from PINUnlockScreen.tsx lines 93-103)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tryClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tryClose]);

  return (
    <main className="bg-background min-h-screen">
      <div className="h-14 flex items-center justify-between max-w-3xl mx-auto px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(1)}
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </Button>
        {stepPillCopy ? (
          <div className="rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs">
            {stepPillCopy}
          </div>
        ) : (
          <div />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={tryClose}
          aria-label="Close send wizard"
        >
          <X size={16} />
        </Button>
      </div>
      <Outlet />
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {"You'll lose what you've entered."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
