import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatDistanceToNow } from "date-fns";
import type { MergedTx } from "@prl-wallet/api-client";
import { satoshisToPrl } from "@prl-wallet/api-client";
import { listRowStyles } from "./ListRow";
import { colors } from "../theme";

type Props = {
  tx: MergedTx;
  onPress: () => void;
};

function formatAmount(netSatoshis: bigint): { text: string; color: string } {
  if (netSatoshis >= 0n) {
    return {
      text: `+${satoshisToPrl(netSatoshis.toString())} PRL`,
      color: colors.success,
    };
  } else {
    return {
      text: `-${satoshisToPrl((netSatoshis).toString())} PRL`,
      color: colors.error,
    };
  }
}

function formatDate(blockTime?: number): string {
  if (blockTime == null) return "Pending";
  return formatDistanceToNow(new Date(blockTime * 1000), { addSuffix: true });
}

export const TransactionRow = React.memo(function TransactionRow({
  tx,
  onPress,
}: Props) {
  const isConfirmed = tx.confirmations != null && tx.confirmations > 0;
  const amount = formatAmount(tx.netSatoshis);
  const dateText = formatDate(tx.blockTime);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Transaction ${tx.txid.slice(0, 8)}`}
    >
      <View style={styles.left}>
        <Text style={[styles.amount, { color: amount.color }]}>
          {amount.text}
        </Text>
        <Text style={styles.date}>{dateText}</Text>
      </View>

      <View style={styles.right}>
        <View
          style={[
            styles.badge,
            isConfirmed ? styles.badgeConfirmed : styles.badgePending,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isConfirmed ? styles.badgeTextConfirmed : styles.badgeTextPending,
            ]}
          >
            {isConfirmed ? "Confirmed" : "Pending"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    ...listRowStyles.row,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flex: 1,
    gap: 4,
  },
  amount: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  date: {
    color: colors.gray500,
    fontSize: 12,
  },
  right: {
    marginLeft: 12,
  },
  badge: {
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  badgeConfirmed: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  badgePending: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  badgeTextConfirmed: {
    color: colors.success,
  },
  badgeTextPending: {
    color: colors.warning,
  },
});
