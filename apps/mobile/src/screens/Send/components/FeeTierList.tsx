import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import type { SendFeeTierId } from "../SendFlowContext";
import { colors, fonts } from "../../../theme";

type FeeTierOption = {
  id: SendFeeTierId;
  label: string;
  etaDisplay: string | null;
  estimatedFeeDisplay: string;
  satVbDisplay: string | null;
  // fiat sublabel per tier. Null when price unavailable
  // (the FeeTierList renders the locked `≈ —` em-dash token in that
  // case per ).
  estimatedFiatDisplay: string | null;
};

type Props = {
  feeTierOptions: FeeTierOption[];
  liveRates: { slow: bigint; medium: bigint; fast: bigint } | null;
  loadingRates: boolean;
  onSelectTier: (tier: SendFeeTierId) => void;
  selectedTier: SendFeeTierId;
  // when true, fiat sublabel renders dimmed +
  // `(stale)` suffix. Forwarded from SendFlowContext.feeIsStale ||
  // priceIsStale (either staleness affects the fiat number).
  feeIsStale?: boolean;
};

export function FeeTierList({
  feeTierOptions,
  liveRates,
  loadingRates,
  onSelectTier,
  selectedTier,
  feeIsStale = false,
}: Props) {
  return (
    <>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>Select Fee Tier</Text>
        {loadingRates ? (
          <ActivityIndicator size="small" color={colors.gray500} />
        ) : liveRates ? (
          <Text style={styles.liveRatesBadge}>● live</Text>
        ) : (
          <Text style={styles.fallbackBadge}>estimated</Text>
        )}
      </View>
      <View style={styles.tiersColumn}>
        {feeTierOptions.map((tier) => {
          const isSelected = selectedTier === tier.id;

          return (
            <TouchableOpacity
              key={tier.id}
              style={[
                styles.tierCard,
                isSelected ? styles.tierCardSelected : styles.tierCardDefault,
              ]}
              onPress={() => {
                onSelectTier(tier.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Select ${tier.label} fee`}
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.tierLeft}>
                <Text
                  style={[
                    styles.tierLabel,
                    isSelected && styles.tierLabelSelected,
                  ]}
                >
                  {tier.label}
                </Text>
                <Text
                  style={[styles.tierEta, isSelected && styles.tierEtaSelected]}
                >
                  {tier.etaDisplay ?? "Custom"}
                  {tier.satVbDisplay ? ` · ${tier.satVbDisplay}` : ""}
                </Text>
              </View>

              <View style={styles.tierRight}>
                <Text
                  style={[styles.tierFee, isSelected && styles.tierFeeSelected]}
                >
                  {tier.estimatedFeeDisplay}{" "}
                  <Text
                    style={[
                      styles.tierFeeUnit,
                      isSelected && styles.tierFeeUnitSelected,
                    ]}
                  >
                    PRL
                  </Text>
                </Text>
                {/* — per-tier fiat sublabel. `≈ —`
                    fallback () when the price feed is unavailable.
                     stale variant: dim opacity + (stale) suffix. */}
                <Text
                  style={[styles.tierFiat, feeIsStale && styles.staleIndicator]}
                  accessibilityLabel={`Approximate ${tier.label} fee in USD`}
                >
                  {tier.estimatedFiatDisplay ?? "≈ —"}
                  {feeIsStale ? " (stale)" : ""}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionLabel: {
    color: colors.gray500,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.sansSemiBold,
  },
  liveRatesBadge: {
    color: colors.success,
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
  },
  fallbackBadge: {
    color: colors.gray500,
    fontSize: 11,
    fontFamily: fonts.sans,
  },
  tiersColumn: {
    gap: 10,
  },
  tierCard: {
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tierCardDefault: {
    borderWidth: 1.5,
    borderColor: colors.gray300,
    backgroundColor: colors.gray50,
  },
  tierCardSelected: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
  },
  tierLeft: {
    gap: 4,
  },
  tierRight: {
    alignItems: "flex-end",
  },
  tierLabel: {
    color: colors.gray700,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
  tierLabelSelected: {
    color: colors.black,
  },
  tierEta: {
    color: colors.gray600,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  tierEtaSelected: {
    color: colors.black,
  },
  tierFee: {
    color: colors.black,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
  },
  tierFeeSelected: {
    color: colors.black,
  },
  tierFeeUnit: {
    color: colors.gray500,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  tierFeeUnitSelected: {
    color: colors.black,
  },
  // fiat sublabel per tier. Smaller + lighter than
  // the native fee row to keep the visual hierarchy (sat fee = primary,
  // fiat = annotation per FEE-PRICE-05 advisory contract).
  tierFiat: {
    color: colors.gray500,
    fontSize: 12,
    fontFamily: fonts.sans,
    marginTop: 2,
  },
  // stale indicator (
  // default for mobile: opacity + (stale) suffix; desktop uses tooltip).
  staleIndicator: {
    opacity: 0.7,
  },
});
