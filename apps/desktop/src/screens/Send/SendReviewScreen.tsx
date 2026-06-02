// apps/desktop/src/screens/Send/SendReviewScreen.tsx
// TX-02 + TX-03. (gate-off banner — neutral),
// (sign-on-arrival via useEffect with useRef guard), (broadcast call
// site is a single visible onBroadcastClick handler so wraps
// via composition — <SensitiveOpGate op={SensitiveOp.SignTx} onConfirm=...>).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { Loader2, Check, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { formatBroadcastError } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SensitiveOpGate } from "@/security/SensitiveOpGate";
import { SensitiveOp } from "@/security/sensitiveOps";
import { useSendFlow } from "./SendFlowProvider";

export function SendReviewScreen() {
  const navigate = useNavigate();
  const { stores, ports } = useAdapters();
  const networkOpen = useStore(stores.networkGate, (s) => s.isOpen);
  const open = useStore(stores.networkGate, (s) => s.open);
  const flow = useSendFlow();
  const {
    recipientAddress,
    recipientAmountDisplay,
    estimatedFeeDisplay,
    feeTierLabel,
    totalDeductedDisplay,
    remainingDisplay,
    walletId,
    signedHandle,
    isSigning,
    prepareSigned,
    broadcast,
    isBroadcasting,
    txid,
    broadcastErrorMessage,
    analyticsFlow,
  } = flow;

  // Pitfall 5 guard — prevent sign-on-arrival from re-firing on every re-render.
  const hasSignedRef = useRef(false);
  const [signError, setSignError] = useState<unknown>(null);

  // review.opened on mount.
  const reviewOpenedEmittedRef = useRef(false);
  useEffect(() => {
    if (reviewOpenedEmittedRef.current) return;
    reviewOpenedEmittedRef.current = true;
    analyticsFlow.step("review.opened");
  }, [analyticsFlow]);

  // : sign-on-arrival, fires exactly once per Review mount.
  useEffect(() => {
    if (hasSignedRef.current || signedHandle || isSigning) return;
    hasSignedRef.current = true;
    setSignError(null);
    prepareSigned().catch((err) => setSignError(err));
  }, [prepareSigned, signedHandle, isSigning]);

  // `signed` step fires when the local sign call resolves
  // (signedHandle becomes non-null). One-shot via ref to avoid duplicate
  // emits on subsequent re-renders.
  const signedEmittedRef = useRef(false);
  useEffect(() => {
    if (signedEmittedRef.current) return;
    if (signedHandle) {
      signedEmittedRef.current = true;
      analyticsFlow.step("signed");
    }
  }, [signedHandle, analyticsFlow]);

  // `broadcast` step fires when the broadcast call begins
  // (isBroadcasting flips true). One-shot.
  const broadcastEmittedRef = useRef(false);
  useEffect(() => {
    if (broadcastEmittedRef.current) return;
    if (isBroadcasting) {
      broadcastEmittedRef.current = true;
      analyticsFlow.step("broadcast");
    }
  }, [isBroadcasting, analyticsFlow]);

  // edge-triggered flow.error on broadcast failure
  // string transitions. Re-renders carrying the same error string emit
  // exactly one analytics event per failure.
  const lastBroadcastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      broadcastErrorMessage &&
      broadcastErrorMessage !== lastBroadcastErrorRef.current
    ) {
      lastBroadcastErrorRef.current = broadcastErrorMessage;
      analyticsFlow.error("broadcast");
    } else if (!broadcastErrorMessage) {
      lastBroadcastErrorRef.current = null;
    }
  }, [broadcastErrorMessage, analyticsFlow]);

  // Auto-navigate to /success once the broadcast resolves with a txid.
  useEffect(() => {
    if (txid) navigate(`/wallet/${walletId}/send/success`);
  }, [txid, navigate, walletId]);

  // "Try again" resets the ref guard and re-fires sign.
  const onRetrySign = useCallback(() => {
    hasSignedRef.current = false;
    setSignError(null);
    void prepareSigned().catch((err) => setSignError(err));
  }, [prepareSigned]);

  // : wrap-not-rewrite: the broadcast button is now wrapped by
  // <SensitiveOpGate op={SensitiveOp.SignTx}> below (search for SensitiveOpGate).
  // The onBroadcastClick callback body is unchanged — composition only.
  const onBroadcastClick = useCallback(async () => {
    if (!signedHandle) return;
    try {
      await broadcast(signedHandle);
      // Navigation happens via the txid useEffect after broadcast success.
    } catch (err) {
      toast.error(`Broadcast failed: ${formatBroadcastError(err)}`);
    }
  }, [signedHandle, broadcast]);

  // Signed-tx preview — give the user a visual confirmation that something
  // concrete was produced. SignedTxHandle is `{ hex: string;
  // previewedTxid: string }`; we surface a shortened hex (first 12 / last 12)
  // and the full previewed txid.
  const signedHex =
    signedHandle && typeof signedHandle === "object" && "hex" in signedHandle
      ? String((signedHandle as { hex: unknown }).hex)
      : null;
  const signedHexShort =
    signedHex && signedHex.length > 26
      ? `${signedHex.slice(0, 12)}…${signedHex.slice(12)}`
      : signedHex;
  const previewedTxid =
    signedHandle &&
    typeof signedHandle === "object" &&
    "previewedTxid" in signedHandle
      ? String((signedHandle as { previewedTxid: unknown }).previewedTxid)
      : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 pb-12">
      <h1 className="text-xl font-semibold leading-snug mb-6">Review</h1>

      {/* Sign-state panel — large, prominent. Three states:
            • signing (in flight) — animated spinner + reassuring copy
            • signed offline (ready) — success accent + tx preview + room for
              future actions (Save for later transmission, etc. — +)
            • errored — handled by the destructive card below
          The pill-sized status from earlier was easy to miss; this panel sits
          above the breakdown so the user always knows what state the
          transaction is in. */}
      {isSigning && !signError && (
        <Card className="p-6 mb-4 border-border bg-muted/30">
          <div className="flex items-center gap-4">
            <Loader2
              className="size-8 animate-spin text-primary shrink-0"
              aria-hidden
            />
            <div className="flex-1">
              <p className="text-base font-semibold leading-snug">
                Signing transaction…
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your wallet is signing locally. No network access is required
                for this step.
              </p>
            </div>
          </div>
        </Card>
      )}
      {signedHandle && !signError && (
        <Card className="p-6 mb-4 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-4">
            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Check className="size-6 text-primary" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold leading-snug">
                  Signed offline
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        className="text-xs text-muted-foreground underline decoration-dotted cursor-help"
                      >
                        what does this mean?
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {"Your wallet has signed this transaction locally. Broadcasting it sends the signed payload to the network — that's the only step that needs the network on."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Your transaction is ready. Broadcast now, or keep it for later.
              </p>
              {signedHexShort && (
                <div className="mt-3 rounded-md bg-background/60 border border-border p-3 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Signed payload (preview)
                    </p>
                    <p className="font-mono text-xs break-all text-foreground/80">
                      {signedHexShort}
                    </p>
                  </div>
                  {previewedTxid && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Previewed TXID
                      </p>
                      <p className="font-mono text-xs break-all text-foreground/80">
                        {previewedTxid}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {/* Action slot — populated by + (Save for later
                  transmission, Copy hex, etc.). Reserved here so the layout
                  doesn't shift when those land. */}
              <div className="mt-3 flex flex-wrap gap-2" />
            </div>
          </div>
        </Card>
      )}

      {/* Summary card — 5 rows */}
      <Card className="p-6">
        <div className="flex justify-between py-3 border-b border-border">
          <span className="text-xs uppercase text-muted-foreground">To</span>
          {/* — inline icon-only CopyButton next to the recipient
              address. The wrapping span keeps the address text + icon visually
              attached on the right side of the row (justify-end). The
              h-6 w-6 p-0 [&>svg]:size-3.5 className override (W-4 invariant)
              prevents the default size="icon" (h-9 w-9) Button from inflating
              row height. */}
          <span className="text-sm font-mono break-all max-w-[60%] text-right inline-flex items-center gap-1 justify-end">
            {recipientAddress}
            <CopyButton
              variant="icon"
              onCopy={() => ports.clipboard.setString(recipientAddress)}
              ariaLabel="Copy recipient address"
              className="h-6 w-6 p-0 [&>svg]:size-3.5"
            />
          </span>
        </div>
        <div className="flex justify-between py-3 border-b border-border">
          <span className="text-xs uppercase text-muted-foreground">
            Amount
          </span>
          <span className="text-sm tabular-nums">{recipientAmountDisplay}</span>
        </div>
        <div className="flex justify-between py-3 border-b border-border">
          <span className="text-xs uppercase text-muted-foreground">
            Network fee
          </span>
          <span className="text-sm tabular-nums">
            {estimatedFeeDisplay} ({feeTierLabel})
          </span>
        </div>
        <div className="flex justify-between py-3 border-b border-border">
          <span className="text-xs uppercase text-muted-foreground">
            Total deducted
          </span>
          <span className="text-sm tabular-nums">{totalDeductedDisplay}</span>
        </div>
        <div className="flex justify-between py-3">
          <span className="text-xs uppercase text-muted-foreground">
            Remaining
          </span>
          <span className="text-sm tabular-nums">{remainingDisplay}</span>
        </div>
      </Card>

      {/* Gate-off banner (, neutral — NOT destructive) */}
      {!networkOpen && (
        <div role="status" aria-live="polite">
          <Card className="bg-card border-border p-4 flex items-center gap-3 mt-4">
            <WifiOff className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm flex-1">
              Network is off. Turn it on to broadcast.
            </p>
            <Button size="sm" onClick={() => open()}>
              Turn on network
            </Button>
          </Card>
        </div>
      )}

      {/* Sign-failed inline destructive card */}
      {signError !== null && (
        <Card className="border-destructive bg-card p-4 mt-4">
          <p className="text-sm text-destructive font-semibold">
            {"Couldn't prepare the transaction."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatBroadcastError(signError)}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onRetrySign}
          >
            Try again
          </Button>
        </Card>
      )}

      {/* Broadcast CTA — : wrapped in SensitiveOpGate op=SignTx.
          The render-prop pattern keeps onBroadcastClick unchanged (wrap-not-rewrite). */}
      <SensitiveOpGate op={SensitiveOp.SignTx} onConfirm={onBroadcastClick}>
        {(trigger) => (
          <Button
            size="lg"
            onClick={trigger}
            disabled={!signedHandle || !networkOpen || isBroadcasting || !!signError}
            className="w-full mt-6"
          >
            {isBroadcasting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Broadcasting...
              </>
            ) : (
              "Broadcast transaction"
            )}
          </Button>
        )}
      </SensitiveOpGate>
    </div>
  );
}
