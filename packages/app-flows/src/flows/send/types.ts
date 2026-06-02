export const FALLBACK_RATES = { slow: 1n, medium: 3n, fast: 6n } as const;
export const TIER_BLOCKS = { slow: 6, medium: 3, fast: 1 } as const;

export const SEND_FEE_TIER_DEFS = [
  { id: "slow", label: "Slow", eta: "~60 min" },
  { id: "medium", label: "Medium", eta: "~15 min" },
  { id: "fast", label: "Fast", eta: "~5 min" },
  { id: "custom", label: "Custom", eta: null },
] as const;

export type SendFeeTierId = (typeof SEND_FEE_TIER_DEFS)[number]["id"];

export type LiveRates = { slow: bigint; medium: bigint; fast: bigint };

export type FeeTierOption = {
  id: SendFeeTierId;
  label: string;
  etaDisplay: string | null;
  estimatedFeeDisplay: string;
  feeRate: bigint;
  satVbDisplay: string | null;
  /**
   * fiat sublabel per tier. Null when price is
   * unavailable (priceUsdPerCoin not provided OR == null). When set,
   * the value is the result of formatFiat(usdValue) — already prefixed
   * with the locked `≈` symbol and suffixed with ` USD`.
   */
  estimatedFiatDisplay: string | null;
};

export const FEE_ESTIMATE_INPUTS = [
  {
    txid: "fee-estimate-input",
    vout: 0,
    value: 0n,
    script: new Uint8Array(),
  },
];
