import { useCallback, useMemo, useState } from "react";
import { satoshisToPrl } from "@prl-wallet/api-client";
import { estimateFee } from "@prl-wallet/core";
import { formatFiat } from "../formatFiat.js";
import {
  type FeeTierOption,
  type LiveRates,
  type SendFeeTierId,
  FALLBACK_RATES,
  FEE_ESTIMATE_INPUTS,
  SEND_FEE_TIER_DEFS,
} from "./types.js";

type UseSendFeeArgs = {
  liveRates: LiveRates | null;
  recipientAddress: string;
  amountSats: bigint;
  /**
   * when provided, populates
   * FeeTierOption.estimatedFiatDisplay per tier. Null/undefined leaves
   * estimatedFiatDisplay null ( callers omit during full
   * unavailability — the UI degrades to `≈ —` via the formatter).
   */
  priceUsdPerCoin?: number | null;
};

export type SendFeeResult = {
  selectedTier: SendFeeTierId;
  selectTier: (tier: SendFeeTierId) => void;
  customSatVbyte: string;
  setCustomSatVbyte: (value: string) => void;
  customError: string | null;
  subtractFeeFromAmount: boolean;
  setSubtractFeeFromAmount: (value: boolean) => void;
  feeTierOptions: FeeTierOption[];
  validateFee: () => boolean;
  getActiveFeeRate: () => bigint;
  computeEstimatedFee: (feeRate: bigint) => bigint;
};

export function useSendFee({
  liveRates,
  recipientAddress,
  amountSats,
  priceUsdPerCoin,
}: UseSendFeeArgs): SendFeeResult {
  const [selectedTier, setSelectedTier] = useState<SendFeeTierId>("medium");
  const [customSatVbyte, setCustomSatVbyte] = useState("5");
  const [customError, setCustomError] = useState<string | null>(null);
  const [subtractFeeFromAmount, setSubtractFeeFromAmount] = useState(false);

  const rates = liveRates ?? FALLBACK_RATES;

  const getActiveFeeRate = useCallback(() => {
    if (selectedTier === "custom") {
      const parsed = Number.parseInt(customSatVbyte, 10);
      return BigInt(Number.isNaN(parsed) || parsed < 1 ? 1 : parsed);
    }
    return rates[selectedTier] ?? rates.medium;
  }, [customSatVbyte, rates, selectedTier]);

  const computeEstimatedFee = useCallback(
    (feeRate: bigint) => {
      const outputs = [
        {
          address: recipientAddress || "placeholder",
          value: amountSats > 0n ? amountSats : 1n,
        },
        { address: "change", value: 1n },
      ];
      return estimateFee(FEE_ESTIMATE_INPUTS, outputs, feeRate);
    },
    [amountSats, recipientAddress],
  );

  const selectTier = useCallback((tier: SendFeeTierId) => {
    setSelectedTier(tier);
    setCustomError(null);
  }, []);

  const feeTierOptions = useMemo(
    (): FeeTierOption[] =>
      SEND_FEE_TIER_DEFS.map((tier) => {
        const feeRate =
          tier.id === "custom"
            ? getActiveFeeRate()
            : (rates[tier.id] ?? rates.medium);
        const estimated = computeEstimatedFee(feeRate);
        // fiat math: (estimated_sats / 1e8) *
        // priceUsdPerCoin gives the USD value of the fee in coin-USD-
        // equivalent dollars. Same formula for BTC + PRL — both use 8
        // decimals (sat/satoshi conceptually identical at the fee
        // calculation layer; PRL.USD is permanently null today per
        // PRL fallback policy, which collapses through formatFiat to
        // `≈ —`).
        const estimatedFiatDisplay =
          priceUsdPerCoin == null
            ? null
            : formatFiat((Number(estimated) / 1e8) * priceUsdPerCoin);

        return {
          ...tier,
          etaDisplay:
            tier.id === "custom"
              ? selectedTier === "custom"
                ? `${customSatVbyte} sat/vB`
                : "Custom rate"
              : tier.eta,
          estimatedFeeDisplay: satoshisToPrl(estimated.toString()),
          feeRate,
          satVbDisplay: tier.id === "custom" ? null : `${feeRate} sat/vB`,
          estimatedFiatDisplay,
        };
      }),
    [
      computeEstimatedFee,
      customSatVbyte,
      getActiveFeeRate,
      rates,
      selectedTier,
      priceUsdPerCoin,
    ],
  );

  const validateFee = useCallback((): boolean => {
    if (selectedTier === "custom") {
      const parsed = Number.parseInt(customSatVbyte, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        setCustomError("Please enter a valid sat/vbyte value (minimum 1).");
        return false;
      }
    }
    setCustomError(null);
    return true;
  }, [customSatVbyte, selectedTier]);

  return {
    selectedTier,
    selectTier,
    customSatVbyte,
    setCustomSatVbyte,
    customError,
    subtractFeeFromAmount,
    setSubtractFeeFromAmount,
    feeTierOptions,
    validateFee,
    getActiveFeeRate,
    computeEstimatedFee,
  };
}
