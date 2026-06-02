import React from "react";
import { StyleSheet, View } from "react-native";
import type { ViewStyle } from "react-native";
import { colors } from "../theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Shared list-row container used by TransactionRow and AddressRow.
 * Provides consistent background, padding, and bottom border.
 */
export function ListRow({ children, style }: Props) {
  return <View style={[listRowStyles.row, style]}>{children}</View>;
}

export const listRowStyles = StyleSheet.create({
  row: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray300,
  },
});
