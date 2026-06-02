import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BalanceSection } from "../../../components/BalanceSection";
import type { WalletType } from "../../../store/walletListStore";
import { colors, fonts } from "../../../theme";

type WalletDetailActionsProps = {
  addresses: string[];
  hasMultipleAddresses: boolean;
  initialConfirmedSats?: string;
  isDiscovering: boolean;
  isRefreshing: boolean;
  networkId: string;
  onOpenAddressList: () => void;
  onOpenReceive: () => void;
  onOpenSend: () => void;
  onOpenTransactionHistory: () => void;
  onPersistBalance: (confirmedSats: string) => void;
  usedAddressCount: number;
  walletType: WalletType | null;
};

export function WalletDetailActions({
  addresses,
  hasMultipleAddresses,
  initialConfirmedSats,
  isDiscovering,
  isRefreshing,
  networkId,
  onOpenAddressList,
  onOpenReceive,
  onOpenSend,
  onOpenTransactionHistory,
  onPersistBalance,
  usedAddressCount,
  walletType,
}: WalletDetailActionsProps) {
  return (
    <>
      <BalanceSection
        addresses={addresses}
        initialConfirmedSats={initialConfirmedSats}
        networkId={networkId}
        onBalanceLoaded={onPersistBalance}
        showLoadingIndicator={isDiscovering || isRefreshing}
      />

      {hasMultipleAddresses && (
        <TouchableOpacity
          onPress={onOpenAddressList}
          accessibilityRole="button"
          accessibilityLabel="View all addresses"
        >
          {/* \u2014 copy is verbatim "View active addresses (N) \u2192".
              The "active" word + filter-sourced count fix the v1.3 drift
              against AddressList (UI-SPEC Lock #8). */}
          <Text style={styles.viewAddressesText}>
            View active addresses ({usedAddressCount}) {"\u2192"}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.historyButton}
        onPress={onOpenTransactionHistory}
        accessibilityRole="button"
        accessibilityLabel="Transaction History"
      >
        <Text style={styles.historyButtonText}>Transaction History</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            (walletType === "xpub" || isDiscovering) &&
              styles.actionButtonDisabled,
          ]}
          disabled={walletType === "xpub" || isDiscovering}
          onPress={onOpenSend}
          accessibilityRole="button"
          accessibilityLabel={
            walletType === "xpub"
              ? "Send (not available for watch-only wallets)"
              : "Send"
          }
        >
          <Text style={styles.actionButtonText}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            isDiscovering && styles.actionButtonDisabled,
          ]}
          disabled={isDiscovering}
          onPress={onOpenReceive}
          accessibilityRole="button"
          accessibilityLabel="Receive"
        >
          <Text style={styles.actionButtonText}>Receive</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  viewAddressesText: {
    color: colors.blue600,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
  },
  historyButton: {
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  historyButtonText: {
    color: colors.gray700,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
  },
  spacer: {
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 16,
  },
  actionButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionButtonDisabled: {
    opacity: 0.3,
  },
  actionButtonText: {
    color: colors.black,
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
  },
});
