import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../../../theme";

type Props = {
  previewAddress: string | null;
};

export function XpubPreviewCard({ previewAddress }: Props) {
  return (
    <>
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          {"\u26A0"} This app only supports Taproot addresses (bc1p...). Your
          wallet must use Taproot for balances to appear.
        </Text>
      </View>

      {previewAddress ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>First receive address:</Text>
          <Text style={styles.previewAddress} selectable>
            {previewAddress}
          </Text>
          <Text style={styles.previewHint}>
            Verify this matches your wallet's first receive address.
          </Text>
        </View>
      ) : null}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Watch-only wallets cannot sign transactions. Only your balance and
          receive address will be available.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  warningBox: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
    fontFamily: fonts.serif,
    lineHeight: 18,
  },
  previewBox: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 4,
  },
  previewLabel: {
    color: colors.success,
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  previewAddress: {
    color: colors.black,
    fontSize: 12,
    fontFamily: fonts.mono,
    lineHeight: 18,
  },
  previewHint: {
    color: colors.blue600,
    fontSize: 12,
    fontFamily: fonts.serif,
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  infoText: {
    color: colors.gray600,
    fontSize: 13,
    fontFamily: fonts.serif,
    lineHeight: 18,
  },
});
