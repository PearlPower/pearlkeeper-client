// apps/desktop/src/screens/Send/SendAmountScreen.tsx
// RHF + zod amount form. Mobile parity for the helpers
// (parsePrlToSats, satoshisToPrl, satoshisToDisplay, subtractFeeFromAmount).
// Text-only input with Use max button (UI-SPEC LOCKED — no range input).

import { useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  formatFiat,
  parsePrlToSats,
  selectSendWallet,
} from "@prl-wallet/app-flows";
import { satoshisToPrl } from "@prl-wallet/api-client";
import { useAdapters } from "@prl-wallet/app-adapters";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { satoshisToDisplay } from "@/lib/satoshisToDisplay";
import { BLOCKCHAINS } from "@prl-wallet/config";
import { useSendFlow } from "./SendFlowProvider";
import { amountSchema } from "./schemas";

export function SendAmountScreen() {
  const navigate = useNavigate();
  const { stores } = useAdapters();
  const flow = useSendFlow();

  const wallet = useStore(stores.walletList, (s) =>
    selectSendWallet(s.wallets, flow.walletId),
  );

  // Derive spendableSats from the wallet's cached balance
  const spendableSats = wallet?.lastKnownBalance
    ? BigInt(wallet.lastKnownBalance)
    : 0n;

  // Derive chainSymbol from BLOCKCHAINS config
  const chainSymbol =
    BLOCKCHAINS.flatMap((bc) => bc.networks).find(
      (n) => n.id === wallet?.networkId,
    )?.symbol ?? "";

  // Estimated fee for Use max — approximation: 250 vbytes * active fee rate
  // The active fee rate is embedded in feeTierOptions for the selectedTier
  const activeTier = flow.feeTierOptions.find(
    (t) => t.id === flow.selectedTier,
  );
  const activeFeeRate = activeTier?.feeRate ?? 3n;
  const estimatedFee = 250n * activeFeeRate;

  const defaultAmountStr =
    flow.amountSats > 0n ? satoshisToPrl(flow.amountSats.toString()) : "";

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(amountSchema(spendableSats)),
    defaultValues: { amount: defaultAmountStr },
  });

  // fiat sublabel re-renders on every keystroke via
  // RHF's useWatch. parsePrlToSats handles the empty + invalid cases by
  // returning null; the fiat math degrades to 0 (which still renders
  // "≈ $0.00 USD" — the user is mid-edit, not in an error state).
  const watchedAmount = useWatch({ control, name: "amount" }) ?? "";
  const parsedSats = parsePrlToSats(watchedAmount);
  const safeSats = parsedSats ?? 0n;
  const fiatSublabel =
    flow.priceUsd == null
      ? "≈ —"
      : formatFiat((Number(safeSats) / 1e8) * flow.priceUsd);

  const onSubmit = handleSubmit((values) => {
    const sats = parsePrlToSats(values.amount);
    if (sats !== null) {
      flow.setAmountSats(sats);
    }
    // amount validated + persisted = tx.send step.
    flow.analyticsFlow.step("amount.entered");
    navigate(`/wallet/${flow.walletId}/send/fee`);
  });

  const handleUseMax = () => {
    const maxSats =
      spendableSats > estimatedFee ? spendableSats - estimatedFee : 0n;
    setValue("amount", satoshisToPrl(maxSats.toString()), {
      shouldValidate: true,
    });
  };

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8 pb-12">
        <h1 className="text-xl font-semibold leading-snug mb-6">
          {flow.screenTitle}
        </h1>
        <form onSubmit={onSubmit}>
          {/* Amount label + Use max row */}
          <div className="flex items-center justify-between mb-2">
            <Label
              htmlFor="send-amount-input"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Amount
            </Label>
            <button
              type="button"
              onClick={handleUseMax}
              className="text-xs text-primary hover:underline ml-auto"
            >
              Use max
            </button>
          </div>

          {/* Hero-sized amount input with chainSymbol suffix */}
          <div className="relative flex items-center">
            <Input
              id="send-amount-input"
              {...register("amount")}
              placeholder="0.0"
              inputMode="decimal"
              autoFocus
              className="h-14 text-3xl tabular-nums font-mono w-full pr-16"
            />
            <span className="absolute right-3 text-sm text-muted-foreground font-mono pointer-events-none">
              {chainSymbol}
            </span>
          </div>

          {/* — fiat sublabel below the amount input.
              Re-renders on every keystroke via RHF useWatch. ≈ — when
              priceUsd null (). Stale variant: opacity-70 + (stale)
              suffix per desktop variant (tooltip preferred but
              `(stale)` text is sufficient + portable across platforms). */}
          <p
            data-testid="fiat-sublabel"
            className={cn(
              "text-sm text-muted-foreground mt-1 tabular-nums",
              flow.priceIsStale && "opacity-70",
            )}
          >
            {fiatSublabel}
            {flow.priceIsStale ? " (stale)" : ""}
          </p>

          {/* Spendable balance helper */}
          <p className="text-xs text-muted-foreground mt-2">
            You have {satoshisToDisplay(wallet?.lastKnownBalance)} {chainSymbol}{" "}
            available.
          </p>

          {errors.amount && (
            <p className="text-sm text-destructive mt-3" role="alert">
              {errors.amount.message}
            </p>
          )}

          {/* Subtract fee from amount toggle */}
          <div className="flex items-center justify-between gap-4 py-4 mt-2 border-t border-border">
            <div className="flex-1">
              <Label
                htmlFor="subtract-fee-switch"
                className="text-sm cursor-pointer"
              >
                Subtract fee from amount
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When on, the network fee is taken out of the amount you send.
              </p>
            </div>
            <Switch
              id="subtract-fee-switch"
              checked={flow.subtractFeeFromAmount}
              onCheckedChange={flow.setSubtractFeeFromAmount}
            />
          </div>

          <div className="flex justify-end mt-4">
            <Button type="submit" size="default">
              Next
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
