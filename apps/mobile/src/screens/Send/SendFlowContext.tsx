import React, { createContext, useContext, useMemo } from "react";
import { Alert } from "react-native";
import { Camera } from "expo-camera";
import { satoshisToPrl, useWalletBalance } from "@prl-wallet/api-client";
import type { Network } from "bitcoinjs-lib";
import { getBlockbookClient } from "../../services/blockbookClient";
import { useWalletListStore } from "../../store/walletListStore";
import {
  type FeeTierOption,
  type LiveRates,
  liveRatesToBigInt,
  type SendFeeTierId,
  SEND_FEE_TIER_DEFS,
  getNetworkMetadata,
  selectSendWallet,
  useAnalyticsFlow,
  type UseAnalyticsFlowApi,
  useFeeOracle,
  usePrice,
  useSendAddress,
  useSendAmount,
  useSendBroadcast,
  useSendFee,
  useSendFlowInit,
  useWalletServices,
} from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import type { NetworkId } from "@prl-wallet/api-schemas";
import { NOOP_ANALYTICS_PORT } from "../../lib/noopAnalyticsPort";

export type { SendFeeTierId, FeeTierOption };

type SendFlowContextValue = {
  walletId: string;
  isWatchOnly: boolean;
  screenTitle: string;
  isInitializing: boolean;
  initError: string | null;

  recipientAddress: string;
  setRecipientAddress: (value: string) => void;
  addressError: string | null;
  validateAddress: () => boolean;

  scannerVisible: boolean;
  openScanner: () => Promise<void>;
  closeScanner: () => void;
  handleQRScanned: (event: { data: string }) => void;
  scanned: boolean;

  amountSats: bigint;
  amountText: string;
  handleAmountTextChange: (text: string) => void;
  handleSliderChange: (value: number) => void;
  sliderPercent: number;
  spendableDisplay: string;
  amountError: string | null;
  isBalanceLoading: boolean;
  validateAmount: () => boolean;

  selectedTier: SendFeeTierId;
  selectTier: (tier: SendFeeTierId) => void;
  customSatVbyte: string;
  setCustomSatVbyte: (value: string) => void;
  customError: string | null;
  subtractFeeFromAmount: boolean;
  setSubtractFeeFromAmount: (value: boolean) => void;
  feeTierOptions: FeeTierOption[];
  liveRates: LiveRates | null;
  loadingRates: boolean;
  validateFee: () => boolean;

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
  showRecipientAmount: boolean;
  totalDeductedDisplay: string;
  remainingDisplay: string;
  remainingBalanceSats: string | null;
  confirmSend: () => Promise<void>;
  retrySend: () => Promise<void>;
  isBroadcasting: boolean;
  canSend: boolean;
  canRetry: boolean;
  errorMessage: string | null;
  txid: string | null;

  // tx.send analytics flow API. Single hook instance
  // hoisted to the provider; each Send screen consumes via context to
  // emit its sub-step event without instantiating duplicate flow timers.
  analyticsFlow: UseAnalyticsFlowApi;
};

const SendFlowContext = createContext<SendFlowContextValue | null>(null);

export function useSendFlow(): SendFlowContextValue {
  const ctx = useContext(SendFlowContext);
  if (!ctx) {
    throw new Error("useSendFlow must be used within SendFlowProvider");
  }
  return ctx;
}

type SendFlowProviderProps = {
  walletId: string;
  children: React.ReactNode;
};

export function SendFlowProvider({
  walletId,
  children,
}: SendFlowProviderProps) {
  const { addressService, transactionService } = useWalletServices();

  // tx.send flow shared API. One useAnalyticsFlow
  // instance per send ceremony; each Send screen reads `analyticsFlow`
  // from context and emits its own step.
  const { services } = useAdapters();
  const analyticsFlow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "tx.send",
  );

  const wallet = useWalletListStore((state) =>
    selectSendWallet(state.wallets, walletId),
  );

  const init = useSendFlowInit(wallet, addressService);

  const networkMetadata = wallet ? getNetworkMetadata(wallet.networkId) : null;
  const walletNetwork =
    (networkMetadata?.network as Network | undefined) ?? null;
  const blockchainName = networkMetadata?.blockchainLabel ?? "address";
  const invalidAddressMessage = `Invalid ${blockchainName} address. Please check and try again.`;
  const isWatchOnly = init.walletType === "xpub";
  const screenTitle = networkMetadata ? `Send ${blockchainName}` : "Send";

  const client = wallet ? getBlockbookClient(wallet.networkId) : null;
  const { confirmed, isLoading: isBalanceLoading } = useWalletBalance(
    client,
    init.walletAddresses,
  );

  const address = useSendAddress({
    walletNetwork,
    bip21Prefix: networkMetadata?.bip21Prefix ?? "",
    invalidAddressMessage,
    isWatchOnly,
    onScanRequested: async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      return status === "granted";
    },
    onInvalidScan: (title, body) => {
      Alert.alert(title, body);
    },
  });

  const amount = useSendAmount(confirmed);

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

  // : port-level LiveRates is number-shaped (TanStack-cache-safe);
  // useSendFee expects BigInt-shaped rates. Convert at the boundary.
  // Memoized so the converted object identity is stable across renders
  // when feeOracle.data identity hasn't changed — otherwise the value
  // memo below would re-allocate every render.
  const feeOracleRatesBig = useMemo(
    () => liveRatesToBigInt(feeOracle.data),
    [feeOracle.data],
  );

  const fee = useSendFee({
    // : prefer live rates from feeOracle. When null (offline +
    // empty LKG, or port undefined), fall through to init.liveRates
    // (also null today). useSendFee's existing FALLBACK_RATES path
    // preserves v1.3 behavior on full unavailability.
    liveRates: feeOracleRatesBig ?? init.liveRates,
    recipientAddress: address.recipientAddress,
    amountSats: amount.amountSats,
    // feed price into useSendFee so each
    // FeeTierOption surfaces estimatedFiatDisplay. Null usd value
    // collapses to estimatedFiatDisplay: null (the FeeTierList
    // component renders `≈ —` in that case).
    priceUsdPerCoin: price.usd,
  });

  const activeFeeRate = fee.getActiveFeeRate();
  const estimatedFeeSats = fee.computeEstimatedFee(activeFeeRate);

  const broadcast = useSendBroadcast({
    transactionService,
    signingWallet: init.signingWallet,
    changeAddress: init.changeAddress,
    recipientAddress: address.recipientAddress,
    amountSats: amount.amountSats,
    activeFeeRate,
    initError: init.initError,
    isInitializing: init.isInitializing,
    isBalanceLoading: init.isInitializing || isBalanceLoading,
  });

  const feeTierLabel =
    fee.selectedTier === "custom"
      ? "Custom"
      : (SEND_FEE_TIER_DEFS.find((t) => t.id === fee.selectedTier)?.label ??
        "Medium");

  const recipientAmountSats = fee.subtractFeeFromAmount
    ? amount.amountSats - estimatedFeeSats > 0n
      ? amount.amountSats - estimatedFeeSats
      : 1n
    : amount.amountSats;
  const totalDeductedSats = fee.subtractFeeFromAmount
    ? amount.amountSats
    : amount.amountSats + estimatedFeeSats;

  const remainingBalanceSatsBig =
    confirmed > 0n ? confirmed - totalDeductedSats : null;
  const remainingDisplay = isBalanceLoading
    ? "..."
    : remainingBalanceSatsBig === null
      ? "-"
      : remainingBalanceSatsBig < 0n
        ? "Insufficient funds"
        : `${satoshisToPrl(remainingBalanceSatsBig.toString())} PRL`;

  const value = useMemo<SendFlowContextValue>(
    () => ({
      walletId,
      isWatchOnly,
      screenTitle,
      isInitializing: init.isInitializing,
      initError: init.initError,

      ...address,

      ...amount,
      isBalanceLoading: init.isInitializing || isBalanceLoading,

      selectedTier: fee.selectedTier,
      selectTier: fee.selectTier,
      customSatVbyte: fee.customSatVbyte,
      setCustomSatVbyte: fee.setCustomSatVbyte,
      customError: fee.customError,
      subtractFeeFromAmount: fee.subtractFeeFromAmount,
      setSubtractFeeFromAmount: fee.setSubtractFeeFromAmount,
      feeTierOptions: fee.feeTierOptions,
      liveRates: feeOracleRatesBig ?? init.liveRates,
      loadingRates: init.loadingRates,
      validateFee: fee.validateFee,

      // fiat price + stale flags surfaced in context.
      priceUsd: price.usd,
      priceIsStale: price.isStale,
      priceIsUnavailable: price.isUnavailable,
      feeIsStale: feeOracle.isStale,
      feeIsUnavailable: feeOracle.isUnavailable,

      amountDisplay: `${satoshisToPrl(amount.amountSats.toString())} PRL`,
      estimatedFeeDisplay: `${satoshisToPrl(estimatedFeeSats.toString())} PRL`,
      feeTierLabel,
      recipientAmountDisplay: `${satoshisToPrl(recipientAmountSats.toString())} PRL`,
      showRecipientAmount: fee.subtractFeeFromAmount,
      totalDeductedDisplay: `${satoshisToPrl(totalDeductedSats.toString())} PRL`,
      remainingDisplay,
      remainingBalanceSats:
        remainingBalanceSatsBig === null
          ? null
          : remainingBalanceSatsBig.toString(),

      ...broadcast,
      analyticsFlow,
    }),
    [
      walletId,
      isWatchOnly,
      screenTitle,
      init.isInitializing,
      init.initError,
      init.liveRates,
      init.loadingRates,
      address,
      amount,
      isBalanceLoading,
      fee.selectedTier,
      fee.selectTier,
      fee.customSatVbyte,
      fee.setCustomSatVbyte,
      fee.customError,
      fee.subtractFeeFromAmount,
      fee.setSubtractFeeFromAmount,
      fee.feeTierOptions,
      fee.validateFee,
      estimatedFeeSats,
      feeTierLabel,
      recipientAmountSats,
      totalDeductedSats,
      remainingDisplay,
      remainingBalanceSatsBig,
      broadcast,
      // feeOracle + price additions to deps.
      feeOracle.data,
      feeOracle.isStale,
      feeOracle.isUnavailable,
      price.usd,
      price.isStale,
      price.isUnavailable,
      // analytics flow API.
      analyticsFlow,
    ],
  );

  return (
    <SendFlowContext.Provider value={value}>
      {children}
    </SendFlowContext.Provider>
  );
}
