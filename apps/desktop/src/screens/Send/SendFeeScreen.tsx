// apps/desktop/src/screens/Send/SendFeeScreen.tsx
// RHF + zod fee form (). 4 RadioGroup tier cards:
// Slow / Normal (recommended) / Fast / Custom. Selected card shows
// border-primary 1.5px accent. Custom card expands inline Input with
// feeSchema validation. Live-rates fallback hint when gate is closed
// and liveRates is null.

import { useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type SendFeeTierId } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSendFlow } from "./SendFlowProvider";
import { feeSchema } from "./schemas";

// UI-SPEC LOCKED tier display labels (medium → "Normal (recommended)")
const TIER_DISPLAY_LABELS: Record<SendFeeTierId, string> = {
  slow: "Slow",
  medium: "Normal (recommended)",
  fast: "Fast",
  custom: "Custom",
};

export function SendFeeScreen() {
  const navigate = useNavigate();
  const { stores } = useAdapters();
  const flow = useSendFlow();

  const networkOpen = useStore(stores.networkGate, (s) => s.isOpen);
  const showFallbackHint = !networkOpen && flow.liveRates === null;

  // fiat sublabel is dimmed when EITHER fee or price
  // is stale (the displayed USD value depends on both inputs).
  const fiatStale = flow.feeIsStale || flow.priceIsStale;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(feeSchema()),
    defaultValues: {
      tier: flow.selectedTier,
      customSatVbyte: flow.customSatVbyte,
    },
  });

  const onSubmit = handleSubmit((values) => {
    flow.setSelectedTier(values.tier as SendFeeTierId);
    flow.setCustomSatVbyte(values.customSatVbyte);
    // tier confirmed = tx.send step.
    flow.analyticsFlow.step("fee.selected");
    navigate(`/wallet/${flow.walletId}/send/review`);
  });

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8 pb-12">
        <h1 className="text-xl font-semibold leading-snug mb-2">
          {flow.screenTitle}
        </h1>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">
          Network fee
        </p>
        <form onSubmit={onSubmit}>
          <Controller
            control={control}
            name="tier"
            render={({ field }) => {
              const selectedTier = field.value as SendFeeTierId;
              return (
                <RadioGroup
                  value={selectedTier}
                  onValueChange={(v) => field.onChange(v as SendFeeTierId)}
                  className="gap-3"
                >
                  {flow.feeTierOptions.map((tier) => {
                    const displayLabel =
                      TIER_DISPLAY_LABELS[tier.id] ?? tier.label;
                    const isSelected = selectedTier === tier.id;

                    return (
                      <div key={tier.id}>
                        <Label
                          htmlFor={`tier-${tier.id}`}
                          className={cn(
                            "block cursor-pointer rounded-xl",
                            isSelected
                              ? "outline outline-[1.5px] outline-primary"
                              : "",
                          )}
                        >
                          <Card
                            className={cn(
                              "p-4 flex items-center gap-3",
                              isSelected
                                ? "border-primary border-[1.5px]"
                                : "border-border border",
                            )}
                          >
                            <RadioGroupItem
                              value={tier.id}
                              id={`tier-${tier.id}`}
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold">
                                  {displayLabel}
                                </p>
                                {tier.etaDisplay && (
                                  <p className="text-xs text-muted-foreground">
                                    {tier.etaDisplay}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end">
                                {tier.satVbDisplay && (
                                  <p className="text-xs text-muted-foreground tabular-nums">
                                    {tier.satVbDisplay}
                                  </p>
                                )}
                                {/* — per-tier fiat
                                    sublabel. ≈ — fallback () when
                                    price is null. stale variant:
                                    opacity-70 + (stale) suffix. */}
                                <p
                                  data-testid={`fiat-sublabel-${tier.id}`}
                                  className={cn(
                                    "text-xs text-muted-foreground tabular-nums",
                                    fiatStale && "opacity-70",
                                  )}
                                >
                                  {tier.estimatedFiatDisplay ?? "≈ —"}
                                  {fiatStale ? " (stale)" : ""}
                                </p>
                              </div>
                            </div>
                          </Card>
                        </Label>

                        {/* Custom rate inline input — expands when Custom selected */}
                        {tier.id === "custom" && isSelected && (
                          <div
                            className="ml-7 mt-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Label
                              htmlFor="custom-rate"
                              className="text-xs text-muted-foreground"
                            >
                              Enter sat/vB:
                            </Label>
                            <Input
                              id="custom-rate"
                              type="number"
                              inputMode="numeric"
                              {...register("customSatVbyte")}
                              className="h-9 font-mono text-sm w-32 mt-1"
                            />
                            {errors.customSatVbyte && (
                              <p
                                className="text-xs text-destructive mt-1"
                                role="alert"
                              >
                                {errors.customSatVbyte.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </RadioGroup>
              );
            }}
          />

          {showFallbackHint && (
            <p className="text-xs text-muted-foreground mt-4">
              Live rates unavailable — using defaults.
            </p>
          )}

          <div className="flex justify-end mt-6">
            <Button type="submit" size="default">
              Next
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
