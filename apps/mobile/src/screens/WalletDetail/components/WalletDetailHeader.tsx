import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { WalletType } from "../../../store/walletListStore";
import { colors, fonts } from "../../../theme";

type WalletDetailHeaderProps = {
  networkId: string;
  onOpenOptionsMenu: () => void;
  walletName: string;
  walletType: WalletType | null;
};

function walletTypeBadge(walletType: WalletType | null): string {
  switch (walletType) {
    case "mnemonic":
      return "HD Wallet";
    case "bip32Seed":
      return "BIP32 Wallet";
    case "wif":
      return "Legacy Wallet";
    case "xpub":
      return "Watch-only";
    default:
      return "Wallet";
  }
}

export function WalletDetailHeader({
  networkId,
  onOpenOptionsMenu,
  walletName,
  walletType,
}: WalletDetailHeaderProps) {
  return (
    <View style={styles.badgeRow}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{walletTypeBadge(walletType)}</Text>
      </View>
      {networkId.includes("testnet") && (
        <View style={styles.testnetBadge}>
          <Text style={styles.testnetBadgeText}>Testnet</Text>
        </View>
      )}
      <View style={styles.badgeSpacer} />
      <Text style={styles.walletName} numberOfLines={1}>
        {walletName}
      </Text>
      <TouchableOpacity
        onPress={onOpenOptionsMenu}
        accessibilityRole="button"
        accessibilityLabel="Wallet options"
        style={styles.moreButton}
      >
        <Text style={styles.moreText}>...</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgeSpacer: {
    flex: 1,
  },
  walletName: {
    color: colors.black,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "500",
    maxWidth: 100,
  },
  moreButton: {
    padding: 4,
  },
  moreText: {
    color: colors.gray500,
    fontFamily: fonts.sansBold,
    fontSize: 18,
    letterSpacing: 2,
  },
  badge: {
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  badgeText: {
    color: colors.gray700,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
  },
  testnetBadge: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  testnetBadgeText: {
    color: colors.warning,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
  },
});
