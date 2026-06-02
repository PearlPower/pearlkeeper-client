// apps/desktop/src/screens/Send/SendFlowProvider.tsx
// wizard cross-step state seam.
// Mounted at the layout route /wallet/:id/send. Mobile parity preserved
// for non-form-state fields ( puts form state in per-screen RHF;
// Provider holds only persistent values).
// Mobile-only QR-scan fields are excluded per TX-05 (desktop paste-only, no camera).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import {
  FALLBACK_RATES,
  SEND_FEE_TIER_DEFS,
  FEE_ESTIMATE_INPUTS,
  formatFiat,
  getNetworkMetadata,
  liveRatesToBigInt,
  selectSendWallet,
  useAnalyticsFlow,
  useFeeOracle,
  usePrice,
  useSendBroadcast,
  useSendFlowInit,
  useWalletServices,
  type FeeTierOption,
  type LiveRates,
  type SendFeeTierId,
  type UseAnalyticsFlowApi,
} from "@prl-wallet/app-flows";
import type { NetworkId } from "@prl-wallet/api-schemas";
import type { SignedTxHandle } from "@prl-wallet/app-flows";
import { satoshisToPrl } from "@prl-wallet/api-client";
import { estimateFee } from "@prl-wallet/core";
import { useAdapters } from "@prl-wallet/app-adapters";
import { NOOP_ANALYTICS_PORT } from "@/lib/noopAnalyticsPort";

export interface SendFlowContextValue {
  // Init / wallet
  walletId: string;
  screenTitle: string;
  isWatchOnly: boolean;
  isInitializing: boolean;
  initError: string | null;

  // Persistent form values (held here so back/forward preserves them)
  recipientAddress: string;
  setRecipientAddress: (value: string) => void;
  amountSats: bigint;
  setAmountSats: (value: bigint) => void;
  selectedTier: SendFeeTierId;
  setSelectedTier: (tier: SendFeeTierId) => void;
  customSatVbyte: string;
  setCustomSatVbyte: (value: string) => void;
  subtractFeeFromAmount: boolean;
  setSubtractFeeFromAmount: (value: boolean) => void;

  // Live fee + display
  feeTierOptions: FeeTierOption[];
  liveRates: LiveRates | null;
  loadingRates: boolean;

  // fiat price + stale/unavailable flags.
  // reads these to render fiat sublabels on send-amount + send-fee
  // screens.
  priceUsd: number | null;
  priceIsStale: boolean;
  priceIsUnavailable: boolean;
  feeIsStale: boolean;
  feeIsUnavailable: boolean;
  amountDisplay: string;
  estimatedFeeDisplay: string;
  feeTierLabel: string;
  recipientAmountDisplay: string;
  totalDeductedDisplay: string;
  remainingDisplay: string;

  // Sign + broadcast ()
  signedHandle: SignedTxHandle | null;
  isSigning: boolean;
  prepareSigned: () => Promise<SignedTxHandle>;
  broadcast: (handle: SignedTxHandle) => Promise<void>;
  isBroadcasting: boolean;
  txid: string | null;
  broadcastErrorMessage: string | null;
  confirmSend: () => Promise<void>;
  retrySend: () => Promise<void>;
  canSend: boolean;
  canRetry: boolean;

  // single hoisted useAnalyticsFlow instance for the
  // tx.send funnel. Provider-hoisted (not per-screen) so all 5 send
  // screens share one startedAtRef + emit a single flow.start. Mirrors
  // mobile SendFlowContext analyticsFlow surface exactly.
  analyticsFlow: UseAnalyticsFlowApi;
}

// Exported so test-only MockSendFlowProvider can inject controlled values
// without spinning up the real Provider chain (screens test the screen, not
// the integration — pattern).
export const SendFlowContext = createContext<SendFlowContextValue | null>(null);

export function useSendFlow(): SendFlowContextValue {
  const ctx = useContext(SendFlowContext);
  if (!ctx) throw new Error("useSendFlow must be used within SendFlowProvider");
  return ctx;
}

export interface SendFlowProviderProps {
  walletId: string;
  children: ReactNode;
}

export function SendFlowProvider({
  walletId,
  children,
}: SendFlowProviderProps) {
  const { stores, services } = useAdapters();
  const { addressService, transactionService } = useWalletServices();

  // single hoisted analytics flow for tx.send. All
  // child send screens (Address/Amount/Fee/Review/Success) consume this
  // via useSendFlow().analyticsFlow so startedAtRef + duration metric
  // remain consistent across the 5-screen wizard.
  const analyticsFlow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "tx.send",
  );

  const wallet = useStore(stores.walletList, (s) =>
    selectSendWallet(s.wallets, walletId),
  );

  const init = useSendFlowInit(wallet, addressService);

  // --- Persistent wizard state () ---
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amountSats, setAmountSats] = useState(0n);
  const [selectedTier, setSelectedTier] = useState<SendFeeTierId>("medium");
  const [customSatVbyte, setCustomSatVbyte] = useState("");
  const [subtractFeeFromAmount, setSubtractFeeFromAmount] = useState(false);

  // live fee tiers + price snapshot. Both hooks accept
  // `null` while the wallet hasn't loaded — no hardcoded fallback network
  // id (which could be disabled in blockchains.json). Symbol flows from
  // chain.assetSymbol in blockchains.json, never assumed.
  const networkId: NetworkId | null = wallet
    ? (wallet.networkId as NetworkId)
    : null;
  const symbol = wallet
    ? getNetworkMetadata(wallet.networkId).assetSymbol
    : null;
  const feeOracle = useFeeOracle(networkId);
  const price = usePrice(symbol);

  // --- Fee derivation (inline — avoids duplicate state with useSendFee) ---
  // : port-level LiveRates is number-shaped (TanStack-cache-safe);
  // tier arithmetic below needs BigInt. Convert at the boundary; memoize
  // so identity is stable across renders when the underlying snapshot
  // identity hasn't changed (otherwise the context-value memo busts every
  // render).
  const feeOracleRatesBig = useMemo(
    () => liveRatesToBigInt(feeOracle.data),
    [feeOracle.data],
  );
  // : prefer live rates from feeOracle. When null, fall through to
  // init.liveRates (also null today) → FALLBACK_RATES (v1.3 behavior).
  const rates = feeOracleRatesBig ?? init.liveRates ?? FALLBACK_RATES;

  const activeFeeRate = useMemo((): bigint => {
    if (selectedTier === "custom") {
      const parsed = Number.parseInt(customSatVbyte, 10);
      return BigInt(Number.isNaN(parsed) || parsed < 1 ? 1 : parsed);
    }
    return rates[selectedTier] ?? rates.medium;
  }, [customSatVbyte, rates, selectedTier]);

  // OPT-4: pure-args helper. Taking amountSats + recipientAddress as
  // arguments (rather than closing over them) makes the function
  // reference stable across renders. The feeTierOptions useMemo below
  // moves the data deps inline so the dep list is honest about what
  // actually causes recomputation — was previously listing
  // `computeEstimatedFee` as a dep, which obscured the real triggers.
  const computeEstimatedFee = useCallback(
    (feeRate: bigint, amount: bigint, recipient: string): bigint => {
      const outputs = [
        {
          address: recipient || "placeholder",
          value: amount > 0n ? amount : 1n,
        },
        { address: "change", value: 1n },
      ];
      return estimateFee(FEE_ESTIMATE_INPUTS, outputs, feeRate);
    },
    [],
  );

  const estimatedFeeSats = computeEstimatedFee(
    activeFeeRate,
    amountSats,
    recipientAddress,
  );

  // desktop's inline tier construction needs to mirror
  // useSendFee's per-tier estimatedFiatDisplay computation. Mobile feeds
  // priceUsdPerCoin into useSendFee; desktop computes it inline since
  // SendFlowProvider doesn't call useSendFee (desktop holds form
  // state in per-screen RHF).
  const priceUsdPerCoin = price.usd;
  const feeTierOptions = useMemo(
    (): FeeTierOption[] =>
      SEND_FEE_TIER_DEFS.map((tier) => {
        const feeRate =
          tier.id === "custom"
            ? activeFeeRate
            : (rates[tier.id] ?? rates.medium);
        const estimated = computeEstimatedFee(
          feeRate,
          amountSats,
          recipientAddress,
        );
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
      activeFeeRate,
      amountSats,
      recipientAddress,
      computeEstimatedFee,
      customSatVbyte,
      rates,
      selectedTier,
      priceUsdPerCoin,
    ],
  );

  // --- Broadcast hook ---
  const broadcastApi = useSendBroadcast({
    transactionService,
    signingWallet: init.signingWallet,
    changeAddress: init.changeAddress,
    recipientAddress,
    amountSats,
    activeFeeRate,
    initError: init.initError,
    isInitializing: init.isInitializing,
    isBalanceLoading: init.isInitializing,
  });

  // RESEARCH Open Question #5 — clear signedHandle on persistent-value change.
  // Surface guaranteed by must_haves — no optional chaining.
  useEffect(() => {
    broadcastApi.resetSignedHandle();
    // broadcastApi intentionally excluded from deps to avoid a loop —
    // resetSignedHandle is a stable useCallback (). The desktop
    // workspace doesn't enable react-hooks/exhaustive-deps so no disable
    // pragma is needed (and one would error as an unknown rule).
  }, [
    recipientAddress,
    amountSats,
    selectedTier,
    customSatVbyte,
    subtractFeeFromAmount,
  ]);

  // --- Network metadata derivation ---
  const networkMeta = useMemo(
    () => (wallet ? getNetworkMetadata(wallet.networkId) : null),
    [wallet],
  );

  const screenTitle = networkMeta
    ? `Send ${networkMeta.blockchainLabel}`
    : "Send";
  const isWatchOnly = init.walletType === "xpub";

  // --- Display derivation (mobile parity from SendFlowContext.tsx) ---
  const feeTierLabel =
    selectedTier === "custom"
      ? "Custom"
      : (SEND_FEE_TIER_DEFS.find((t) => t.id === selectedTier)?.label ??
        "Medium");

  const recipientAmountSats = subtractFeeFromAmount
    ? amountSats - estimatedFeeSats > 0n
      ? amountSats - estimatedFeeSats
      : 1n
    : amountSats;

  const totalDeductedSats = subtractFeeFromAmount
    ? amountSats
    : amountSats + estimatedFeeSats;

  // Display unit follows the wallet's chain (label from blockchains.json).
  // Empty string while no wallet is loaded — display strings render as
  // amount-only with no trailing symbol rather than assuming a chain.
  const displaySymbol = networkMeta?.blockchainLabel ?? "";

  const amountDisplay = `${satoshisToPrl(amountSats.toString())} ${displaySymbol}`;
  const estimatedFeeDisplay = `${satoshisToPrl(estimatedFeeSats.toString())} ${displaySymbol}`;
  const recipientAmountDisplay = `${satoshisToPrl(recipientAmountSats.toString())} ${displaySymbol}`;
  const totalDeductedDisplay = `${satoshisToPrl(totalDeductedSats.toString())} ${displaySymbol}`;

  // "Remaining" = wallet's spendable balance MINUS this transaction's total
  // deducted. Source of truth for the spendable balance is
  // wallet.lastKnownBalance (cached, updated by WalletDetail when live data
  // is available). When totalDeducted >= cached balance we
  // clamp at 0 rather than showing a negative value.
  const cachedBalanceSats = wallet?.lastKnownBalance
    ? BigInt(wallet.lastKnownBalance)
    : 0n;
  const remainingSats =
    cachedBalanceSats > totalDeductedSats
      ? cachedBalanceSats - totalDeductedSats
      : 0n;
  const remainingDisplay = `${satoshisToPrl(remainingSats.toString())} ${displaySymbol}`;

  const value = useMemo<SendFlowContextValue>(
    () => ({
      walletId,
      screenTitle,
      isWatchOnly,
      isInitializing: init.isInitializing,
      initError: init.initError,

      recipientAddress,
      setRecipientAddress,
      amountSats,
      setAmountSats,
      selectedTier,
      setSelectedTier,
      customSatVbyte,
      setCustomSatVbyte,
      subtractFeeFromAmount,
      setSubtractFeeFromAmount,

      feeTierOptions,
      liveRates: feeOracleRatesBig ?? init.liveRates,
      loadingRates: init.loadingRates,

      // fiat price + stale flags surfaced in context.
      priceUsd: price.usd,
      priceIsStale: price.isStale,
      priceIsUnavailable: price.isUnavailable,
      feeIsStale: feeOracle.isStale,
      feeIsUnavailable: feeOracle.isUnavailable,

      amountDisplay,
      estimatedFeeDisplay,
      feeTierLabel,
      recipientAmountDisplay,
      totalDeductedDisplay,
      remainingDisplay,

      signedHandle: broadcastApi.signedHandle,
      isSigning: broadcastApi.isSigning,
      prepareSigned: broadcastApi.prepareSigned,
      broadcast: broadcastApi.broadcast,
      isBroadcasting: broadcastApi.isBroadcasting,
      txid: broadcastApi.txid,
      broadcastErrorMessage: broadcastApi.errorMessage,
      confirmSend: broadcastApi.confirmSend,
      retrySend: broadcastApi.retrySend,
      canSend: broadcastApi.canSend,
      canRetry: broadcastApi.canRetry,

      // shared analytics surface.
      analyticsFlow,
    }),
    [
      walletId,
      screenTitle,
      isWatchOnly,
      init.isInitializing,
      init.initError,
      init.liveRates,
      init.loadingRates,
      recipientAddress,
      amountSats,
      selectedTier,
      customSatVbyte,
      subtractFeeFromAmount,
      feeTierOptions,
      amountDisplay,
      estimatedFeeDisplay,
      feeTierLabel,
      recipientAmountDisplay,
      totalDeductedDisplay,
      remainingDisplay,
      broadcastApi.signedHandle,
      broadcastApi.isSigning,
      broadcastApi.prepareSigned,
      broadcastApi.broadcast,
      broadcastApi.isBroadcasting,
      broadcastApi.txid,
      broadcastApi.errorMessage,
      broadcastApi.confirmSend,
      broadcastApi.retrySend,
      broadcastApi.canSend,
      broadcastApi.canRetry,
      // feeOracle + price additions to deps.
      feeOracle.data,
      feeOracle.isStale,
      feeOracle.isUnavailable,
      price.usd,
      price.isStale,
      price.isUnavailable,
      // analytics flow API stability.
      analyticsFlow,
    ],
  );

  return (
    <SendFlowContext.Provider value={value}>
      {children}
    </SendFlowContext.Provider>
  );
}
