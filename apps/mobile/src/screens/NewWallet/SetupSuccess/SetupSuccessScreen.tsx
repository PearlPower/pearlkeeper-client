import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { RouteProp } from "@react-navigation/native";
import { getNetworkMetadata, useSetupSuccessFlow } from "@prl-wallet/app-flows";
import type { NewWalletStackParamList } from "../services/newWalletFlowTypes";
import { useNewWalletContext } from "../NewWalletContext";
import { navigationRef } from "../../../navigation/navigationRef";
import { colors, fonts, cardShadow } from "../../../theme";

type Props = {
  route: RouteProp<NewWalletStackParamList, "SetupSuccess">;
};

function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}...${address.slice(6)}`;
}

export default function SetupSuccessScreen({ route }: Props) {
  const { walletId, walletName, address } = route.params;
  const { ports, networkConfig } = useNewWalletContext();
  const { createWallet, isSubmitting } = useSetupSuccessFlow({
    ports,
    walletId,
    walletName,
    address,
    networkId: networkConfig.id,
    navigation: {
      resetToRoot: (nextWalletId) =>
        navigationRef.reset({
          index: 1,
          routes: [
            { name: "WalletList" },
            { name: "WalletDetail", params: { walletId: nextWalletId } },
          ],
        }),
    },
  });

  const { blockchainLabel, networkName } = getNetworkMetadata(networkConfig.id);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.checkmark}>&#10003;</Text>
        <Text style={styles.title}>Wallet Ready!</Text>
        <Text style={styles.subtitle}>
          Review your wallet details before saving.
        </Text>

        <View style={styles.summaryBox}>
          <SummaryRow label="Name" value={walletName} />
          <View style={styles.divider} />
          <SummaryRow label="Blockchain" value={blockchainLabel} />
          <View style={styles.divider} />
          <SummaryRow label="Network" value={networkName} />
          <View style={styles.divider} />
          <SummaryRow label="Address" value={truncateAddress(address)} mono />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={createWallet}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Create wallet"
      >
        <Text style={styles.buttonText}>Create wallet</Text>
      </TouchableOpacity>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text style={[summaryStyles.value, mono && summaryStyles.mono]}>
        {value}
      </Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  label: {
    color: colors.gray500,
    fontSize: 13,
    fontFamily: fonts.sansSemiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    color: colors.black,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 13,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  checkmark: {
    fontSize: 56,
    color: colors.success,
    fontFamily: fonts.sansBold,
    lineHeight: 72,
  },
  title: {
    color: colors.black,
    fontSize: 30,
    fontFamily: fonts.sansBold,
    textAlign: "center",
  },
  subtitle: {
    color: colors.gray600,
    fontSize: 15,
    textAlign: "center",
    fontFamily: fonts.serif,
  },
  summaryBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 20,
    width: "100%",
    marginTop: 8,
    ...cardShadow,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray300,
  },
  button: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.black,
    fontSize: 18,
    fontFamily: fonts.sansSemiBold,
  },
});
