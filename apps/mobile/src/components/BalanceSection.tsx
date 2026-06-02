import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useWalletBalance, satoshisToPrl } from "@prl-wallet/api-client";
import {
  formatFiat,
  getNetworkMetadata,
  usePrice,
} from "@prl-wallet/app-flows";
import { getBlockbookClient } from "../services/blockbookClient";
import { colors, fonts } from "../theme";

interface BalanceSectionProps {
  addresses: string[];
  initialConfirmedSats?: string;
  /**
   * Required — every caller resolves `networkId` from the wallet record.
   * No hardcoded fallback default: a default like "prl-mainnet" can be
   * disabled in blockchains.json and would render stale data.
   */
  networkId: string;
  onBalanceLoaded?: (confirmedSats: string) => void;
  showLoadingIndicator?: boolean;
}

export function BalanceSection({
  addresses,
  initialConfirmedSats,
  networkId,
  onBalanceLoaded,
  showLoadingIndicator = false,
}: BalanceSectionProps) {
  // fiat balance sublabel. Symbol flows from
  // chain.assetSymbol in blockchains.json. PRL.USD is permanently null
  // today ( PRL fallback policy) which collapses to the locked
  // `≈ —` em-dash token ().
  const symbol = getNetworkMetadata(networkId).assetSymbol;
  const price = usePrice(symbol);
  const client = getBlockbookClient(networkId);
  const {
    confirmed,
    unconfirmed,
    hasData,
    isError,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useWalletBalance(client, addresses);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const hasStoredBalance = initialConfirmedSats !== undefined;
  const storedConfirmed = hasStoredBalance ? BigInt(initialConfirmedSats) : 0n;
  const displayConfirmed = hasData ? confirmed : storedConfirmed;
  const showingStoredBalance = !hasData && hasStoredBalance;
  const shouldShowInlineLoading =
    showingStoredBalance && (showLoadingIndicator || isFetching || isLoading);

  // OPT-3: guard `onBalanceLoaded` against duplicate fires. The effect's
  // dep array includes `onBalanceLoaded` — if the parent doesn't memoize
  // it, the effect fires on every parent render even when the underlying
  // balance value hasn't changed, triggering redundant storage writes.
  // Track the last-persisted value via ref and only call when it
  // genuinely changes.
  const lastPersistedRef = useRef<string | null>(null);
  React.useEffect(() => {
    if (!hasData || !onBalanceLoaded) return;
    const next = confirmed.toString();
    if (lastPersistedRef.current === next) return;
    lastPersistedRef.current = next;
    onBalanceLoaded(next);
  }, [confirmed, hasData, onBalanceLoaded]);

  if (
    (isLoading || isFetching || showLoadingIndicator) &&
    !hasData &&
    !hasStoredBalance
  ) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={colors.blue600}
          accessibilityLabel="Loading balance"
        />
      </View>
    );
  }

  if (isError && !hasData && !hasStoredBalance) {
    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : error != null
          ? String(error)
          : "Unknown error";
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Unable to load balance</Text>
        <View style={styles.errorActions}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading balance"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => setShowErrorDetails((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle error details"
          >
            <Text style={styles.detailsButtonText}>
              {showErrorDetails ? "Hide details" : "Show details"}
            </Text>
          </TouchableOpacity>
        </View>
        {showErrorDetails && (
          <View style={styles.errorDetailsPanel}>
            <ScrollView style={styles.errorDetailsScroll}>
              <Text style={styles.errorDetailsText} selectable>
                {errorMessage}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  const confirmedStr = displayConfirmed.toString();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.balanceLabel}>
          {showingStoredBalance ? "Last known balance" : "Balance"}
        </Text>
        {shouldShowInlineLoading && (
          <ActivityIndicator
            size="small"
            color={colors.blue600}
            style={styles.fetchingIndicator}
            accessibilityLabel="Loading updated balance"
          />
        )}
      </View>

      <Text style={styles.balanceValue}>{satoshisToPrl(confirmedStr)} PRL</Text>

      {/* — fiat balance sublabel. Renders `≈ —` when
          the price feed is unavailable ( em-dash token). stale
          treatment: dim opacity + (stale) suffix. */}
      <Text
        style={[styles.fiatBalance, price.isStale && styles.staleIndicator]}
        accessibilityLabel="Approximate balance in USD"
      >
        {price.usd == null
          ? "≈ —"
          : formatFiat((Number(displayConfirmed) / 1e8) * price.usd)}
        {price.isStale ? " (stale)" : ""}
      </Text>

      {unconfirmed !== 0n && (
        <Text style={styles.unconfirmedText}>
          {unconfirmed > 0n ? "+" : "-"}{" "}
          {satoshisToPrl(
            (unconfirmed < 0n ? -unconfirmed : unconfirmed).toString(),
          )}{" "}
          unconfirmed
        </Text>
      )}

      {isError && showingStoredBalance && (
        <View style={styles.inlineErrorContainer}>
          <Text style={styles.inlineErrorText}>
            Error fetching updated balance.
          </Text>
          <TouchableOpacity
            onPress={() => setShowErrorDetails((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={
              showErrorDetails
                ? "Hide balance error details"
                : "Show balance error details"
            }
          >
            <Text style={styles.inlineErrorLink}>
              {showErrorDetails ? "Hide details" : "Show details"}
            </Text>
          </TouchableOpacity>
          {showErrorDetails && (
            <View style={styles.errorDetailsPanel}>
              <ScrollView style={styles.errorDetailsScroll}>
                <Text style={styles.errorDetailsText} selectable>
                  {error instanceof Error && error.message
                    ? error.message
                    : error != null
                      ? String(error)
                      : "Unknown error"}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  errorContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 24,
  },
  errorText: {
    color: colors.gray500,
    fontFamily: fonts.serif,
    fontSize: 15,
  },
  errorActions: {
    flexDirection: "row",
    gap: 10,
  },
  retryButton: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    color: colors.black,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
  },
  detailsButton: {
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  detailsButtonText: {
    color: colors.gray600,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  errorDetailsPanel: {
    width: "100%",
    maxHeight: 120,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 8,
    padding: 12,
  },
  errorDetailsScroll: {
    maxHeight: 96,
  },
  errorDetailsText: {
    color: colors.error,
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceLabel: {
    color: colors.gray500,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fetchingIndicator: {
    marginTop: 1,
  },
  balanceValue: {
    color: colors.black,
    fontFamily: fonts.displayLight,
    fontSize: 48,
  },
  // fiat balance sublabel. Muted + smaller than the
  // hero balance value to keep the visual hierarchy.
  fiatBalance: {
    color: colors.gray500,
    fontFamily: fonts.sans,
    fontSize: 14,
    marginTop: 2,
  },
  // stale indicator (mobile variant — opacity).
  staleIndicator: {
    opacity: 0.7,
  },
  unconfirmedText: {
    color: colors.gray600,
    fontFamily: fonts.serif,
    fontSize: 14,
  },
  inlineErrorContainer: {
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  inlineErrorText: {
    color: colors.warning,
    fontFamily: fonts.sans,
    fontSize: 13,
    textAlign: "center",
  },
  inlineErrorLink: {
    color: colors.blue600,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
  },
});
