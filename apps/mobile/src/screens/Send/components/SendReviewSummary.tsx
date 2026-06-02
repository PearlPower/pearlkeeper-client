import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, cardShadow } from "../../../theme";

type Props = {
  amountDisplay: string;
  estimatedFeeDisplay: string;
  feeTierLabel: string;
  isLoading: boolean;
  recipientAddress: string;
  recipientAmountDisplay: string;
  remainingBalanceSats: string | null;
  remainingDisplay: string;
  showRecipientAmount: boolean;
  totalDeductedDisplay: string;
};

export function SendReviewSummary({
  amountDisplay,
  estimatedFeeDisplay,
  feeTierLabel,
  isLoading,
  recipientAddress,
  recipientAmountDisplay,
  remainingBalanceSats,
  remainingDisplay,
  showRecipientAmount,
  totalDeductedDisplay,
}: Props) {
  const isNegativeRemaining =
    remainingBalanceSats !== null && BigInt(remainingBalanceSats) < 0n;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>To</Text>
        <Text style={styles.summaryValueMono} selectable>
          {recipientAddress}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.summaryRowInline}>
        <Text style={styles.summaryLabel}>
          {showRecipientAmount ? "Total to spend" : "Amount"}
        </Text>
        <Text style={styles.summaryValue}>{amountDisplay}</Text>
      </View>

      {showRecipientAmount ? (
        <>
          <View style={styles.divider} />
          <View style={styles.summaryRowInline}>
            <Text style={styles.summaryLabel}>Recipient receives</Text>
            <Text style={styles.summaryValue}>{recipientAmountDisplay}</Text>
          </View>
        </>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.summaryRowInline}>
        <Text style={styles.summaryLabel}>Fee tier</Text>
        <Text style={styles.summaryValue}>{feeTierLabel}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.summaryRowInline}>
        <Text style={styles.summaryLabel}>Fee (est.)</Text>
        <Text style={styles.summaryValue}>{estimatedFeeDisplay}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.summaryRowInline}>
        <Text style={styles.summaryLabel}>Total (est.)</Text>
        <Text style={styles.summaryValue}>{totalDeductedDisplay}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.summaryRowInline}>
        <Text style={styles.summaryLabel}>Remaining</Text>
        <Text
          style={[
            styles.summaryValue,
            isNegativeRemaining ? styles.summaryValueWarning : null,
          ]}
        >
          {isLoading ? "..." : remainingDisplay}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    ...cardShadow,
  },
  summaryRow: {
    gap: 6,
  },
  summaryRowInline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: colors.gray500,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.sansSemiBold,
  },
  summaryValue: {
    color: colors.black,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
  },
  summaryValueWarning: {
    color: colors.error,
  },
  summaryValueMono: {
    color: colors.black,
    fontSize: 12,
    fontFamily: fonts.mono,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray300,
  },
});
