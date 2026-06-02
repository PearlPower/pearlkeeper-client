import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { colors, fonts } from "../../../theme";

type Props = {
  customError: string | null;
  customSatVbyte: string;
  onChangeText: (text: string) => void;
};

export function CustomFeeInput({
  customError,
  customSatVbyte,
  onChangeText,
}: Props) {
  return (
    <View style={styles.customInputSection}>
      <Text style={styles.inputLabel}>Custom Fee Rate (sat/vbyte)</Text>
      <TextInput
        style={styles.customInput}
        value={customSatVbyte}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        placeholder="5"
        placeholderTextColor={colors.gray500}
        returnKeyType="done"
      />
      {customError ? <Text style={styles.errorText}>{customError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  customInputSection: {
    gap: 8,
  },
  inputLabel: {
    color: colors.gray500,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.sansSemiBold,
  },
  customInput: {
    color: colors.black,
    fontSize: 18,
    fontFamily: fonts.sansSemiBold,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
});
