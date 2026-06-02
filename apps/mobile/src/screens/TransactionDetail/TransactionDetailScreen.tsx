import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTx, satoshisToPrl } from "@prl-wallet/api-client";
import type { BlockbookVin, BlockbookVout } from "@prl-wallet/api-client";
import { useWalletListStore } from "../../store/walletListStore";
import { getBlockbookClient } from "../../services/blockbookClient";
import { RootStackParamList } from "../../navigation/types";
import { colors, fonts, cardShadow } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<
    RootStackParamList,
    "TransactionDetail"
  >;
  route: RouteProp<RootStackParamList, "TransactionDetail">;
};

export default function TransactionDetailScreen({ navigation, route }: Props) {
  // H-1: addresses come from TransactionList via route params. The list
  // screen already knows the active wallet's address set; threading it
  // through avoids re-deriving it here (and avoids the prior bug where
  // `addresses = []` was hardcoded, leaving "Your Addresses" permanently
  // empty for real wallet transactions).
  const { txid, addresses } = route.params;
  const insets = useSafeAreaInsets();

  const wallets = useWalletListStore((s) => s.wallets);
  const activeWalletId = useWalletListStore((s) => s.activeWalletId);
  const activeWallet =
    wallets.find((w) => w.id === activeWalletId) ?? wallets[0] ?? null;
  // No hardcoded chain fallback: when no wallet is selected, the client is
  // null and downstream hooks (useTx) skip the query. The navigation invariant
  // guarantees activeWallet on this screen in practice; null-tolerance is
  // defense-in-depth.
  const client = activeWallet
    ? getBlockbookClient(activeWallet.networkId)
    : null;

  // H-2: memoize so the Set + filters don't re-run on every render when
  // tx/addresses identity is stable. For a confirmed coinjoin tx with
  // hundreds of vouts this is the difference between O(N×M) per render
  // and O(N×M) per data update.
  const addressSet = useMemo(() => new Set<string>(addresses), [addresses]);

  const { data: tx, isLoading, isError, refetch } = useTx(client, txid);

  const [copied, setCopied] = useState(false);
  const [showAllDetails, setShowAllDetails] = useState(false);

  async function handleCopy() {
    if (!tx) return;
    await Clipboard.setStringAsync(tx.txid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.blue600} />
      </View>
    );
  }

  if (isError || !tx) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Failed to load transaction.</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => refetch()}
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isConfirmed = tx.confirmations != null && tx.confirmations > 0;
  const truncatedTxid = tx.txid.slice(0, 8) + "..." + tx.txid.slice(8);

  // H-2: memoize the per-tx filter work. tx is a stable TanStack cache ref;
  // addressSet is memoized above. The filter result identity stays stable
  // across renders until either input changes.
  const { myVouts, myVins, hasUserInvolvement } = useMemo(() => {
    const vouts = tx.vout.filter(
      (vout) => vout.addresses && vout.addresses.some((a) => addressSet.has(a)),
    );
    const vins = tx.vin.filter(
      (vin) => vin.addresses && vin.addresses.some((a) => addressSet.has(a)),
    );
    return {
      myVouts: vouts,
      myVins: vins,
      hasUserInvolvement: vouts.length > 0 || vins.length > 0,
    };
  }, [tx, addressSet]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 48 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Transaction</Text>

        <View style={styles.card}>
          <Text style={styles.label}>TXID</Text>
          <View style={styles.txidRow}>
            <Text style={styles.txidText}>{truncatedTxid}</Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel="Copy transaction ID"
            >
              <Text style={styles.copyButtonText}>
                {copied ? "Copied!" : "Copy"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Status</Text>
          <Text
            style={[
              styles.value,
              isConfirmed ? styles.valueConfirmed : styles.valuePending,
            ]}
          >
            {isConfirmed ? `Confirmed (${tx.confirmations})` : "Pending"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Fee</Text>
          <Text style={styles.value}>{satoshisToPrl(tx.fees ?? "0")} PRL</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>
            {tx.blockTime
              ? new Date(tx.blockTime * 1000).toLocaleString()
              : "Pending"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Addresses</Text>

          {!hasUserInvolvement ? (
            <Text style={styles.noInvolvement}>No direct involvement</Text>
          ) : (
            <>
              {myVouts.map((vout, idx) => (
                <VoutRow key={`my-vout-${idx}`} vout={vout} />
              ))}
              {myVins.map((vin, idx) => (
                <VinRow key={`my-vin-${idx}`} vin={vin} sent />
              ))}
            </>
          )}

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowAllDetails((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.toggleButtonText}>
              {showAllDetails ? "Hide details" : "More details"}
            </Text>
          </TouchableOpacity>
        </View>

        {showAllDetails && (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Inputs</Text>
              {tx.vin.map((vin, idx) => (
                <VinRow key={`all-vin-${idx}`} vin={vin} />
              ))}
              {tx.vin.length === 0 && (
                <Text style={styles.noInvolvement}>No inputs</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Outputs</Text>
              {tx.vout.map((vout, idx) => (
                <VoutRow key={`all-vout-${idx}`} vout={vout} />
              ))}
              {tx.vout.length === 0 && (
                <Text style={styles.noInvolvement}>No outputs</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function VoutRow({ vout }: { vout: BlockbookVout }) {
  return (
    <View style={styles.ioRow}>
      <Text style={styles.ioAmount}>+ {satoshisToPrl(vout.value)} PRL</Text>
      {vout.addresses && vout.addresses.length > 0 && (
        <Text style={styles.ioAddress} numberOfLines={1} ellipsizeMode="middle">
          {vout.addresses[0]}
        </Text>
      )}
    </View>
  );
}

function VinRow({ vin, sent }: { vin: BlockbookVin; sent?: boolean }) {
  return (
    <View style={styles.ioRow}>
      <Text style={[styles.ioAmount, sent && styles.ioAmountSent]}>
        - {satoshisToPrl(vin.value ?? "0")} PRL
      </Text>
      {vin.addresses && vin.addresses.length > 0 && (
        <Text style={styles.ioAddress} numberOfLines={1} ellipsizeMode="middle">
          {vin.addresses[0]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 16,
    zIndex: 10,
  },
  backButtonText: {
    color: colors.blue600,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 12,
  },
  pageTitle: {
    color: colors.black,
    fontFamily: fonts.displayLight,
    fontSize: 28,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    ...cardShadow,
    padding: 14,
    gap: 6,
  },
  label: {
    color: colors.gray500,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  txidRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  txidText: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "monospace",
  },
  copyButton: {
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  copyButtonText: {
    color: colors.blue600,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
  },
  value: {
    color: colors.black,
    fontFamily: fonts.serif,
    fontSize: 15,
  },
  valueConfirmed: {
    color: colors.success,
  },
  valuePending: {
    color: colors.warning,
  },
  sectionTitle: {
    color: colors.gray500,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  noInvolvement: {
    color: colors.gray500,
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: "italic",
  },
  toggleButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  toggleButtonText: {
    color: colors.blue600,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
  },
  ioRow: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray300,
    gap: 2,
  },
  ioAmount: {
    color: colors.success,
    fontSize: 14,
    fontFamily: "monospace",
    fontWeight: "500",
  },
  ioAmountSent: {
    color: colors.error,
  },
  ioAddress: {
    color: colors.gray500,
    fontSize: 11,
    fontFamily: "monospace",
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.serif,
    fontSize: 15,
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryButton: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: colors.black,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
  },
});
