import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWalletTransactionHistory } from "@prl-wallet/api-client";
import type { MergedTx } from "@prl-wallet/api-client";
import { useWalletListStore } from "../../store/walletListStore";
import { getBlockbookClient } from "../../services/blockbookClient";
import { TransactionRow } from "../../components/TransactionRow";
import { RootStackParamList } from "../../navigation/types";
import { colors, fonts } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "TransactionList">;
  route: RouteProp<RootStackParamList, "TransactionList">;
};

export default function TransactionListScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();

  const wallets = useWalletListStore((s) => s.wallets);
  const activeWalletId = useWalletListStore((s) => s.activeWalletId);
  const activeWallet =
    wallets.find((w) => w.id === activeWalletId) ?? wallets[0] ?? null;
  // No hardcoded chain fallback: when no wallet is selected the client is
  // null and downstream hooks skip the query.
  const client = activeWallet
    ? getBlockbookClient(activeWallet.networkId)
    : null;

  const addresses = route.params.addresses;

  const {
    transactions,
    isLoading,
    isFetching,
    isError,
    loadedCount,
    refetch,
    hasMore,
    isFetchingMore,
    fetchMore,
  } = useWalletTransactionHistory(client, addresses);

  const totalCount = addresses.length;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
      setLastUpdated(new Date());
    }
  }, [refetch]);

  type Tab = "all" | "received" | "sent";
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const filteredTransactions =
    activeTab === "received"
      ? transactions.filter((tx) => tx.netSatoshis >= 0n)
      : activeTab === "sent"
        ? transactions.filter((tx) => tx.netSatoshis < 0n)
        : transactions;

  const subtitle =
    transactions.length > 0
      ? `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}${lastUpdated ? ` · ${lastUpdated.toLocaleTimeString()}` : ""}`
      : lastUpdated
        ? `Updated ${lastUpdated.toLocaleTimeString()}`
        : "";

  const renderItem = useCallback(
    ({ item }: { item: MergedTx }) => (
      <TransactionRow
        tx={item}
        onPress={() =>
          navigation.navigate("TransactionDetail", {
            txid: item.txid,
            // H-1: thread addresses through so the detail screen's
            // "Your Addresses" filter actually finds wallet vouts/vins.
            addresses,
          })
        }
      />
    ),
    [navigation, addresses],
  );

  const renderFooter = () => {
    if (isFetchingMore) {
      return (
        <View style={styles.footerIndicator}>
          <ActivityIndicator size="small" color={colors.blue600} />
        </View>
      );
    }
    if (!hasMore && transactions.length > 0 && !isLoading) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>All transactions loaded</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Transactions</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.tabBar}>
        {(["all", "received", "sent"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(isLoading || (isFetching && transactions.length === 0)) && (
        <View style={styles.progressBanner}>
          <ActivityIndicator
            size="small"
            color={colors.blue600}
            style={styles.progressSpinner}
          />
          <Text style={styles.progressText}>
            {loadedCount === 0
              ? `Fetching from ${totalCount} address${totalCount !== 1 ? "es" : ""}…`
              : `Loaded ${loadedCount}/${totalCount} address${totalCount !== 1 ? "es" : ""}…`}
          </Text>
        </View>
      )}

      {isError && transactions.length > 0 && (
        <View style={styles.staleBanner}>
          <Text style={styles.staleBannerText}>Data may be outdated</Text>
        </View>
      )}

      {isError && transactions.length === 0 && !isLoading && !isFetching && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load transactions.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !isError && filteredTransactions.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {transactions.length === 0
              ? "No transactions yet"
              : activeTab === "received"
                ? "No received transactions"
                : "No sent transactions"}
          </Text>
        </View>
      )}

      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.txid}
        renderItem={renderItem}
        contentContainerStyle={
          filteredTransactions.length === 0
            ? styles.flatListEmpty
            : styles.listContent
        }
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (hasMore && !isFetchingMore) fetchMore();
        }}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.blue600}
            colors={[colors.blue600]}
          />
        }
      />
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
  flatListEmpty: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  backButtonText: {
    color: colors.blue600,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  title: {
    color: colors.black,
    fontFamily: fonts.displayLight,
    fontSize: 28,
    paddingHorizontal: 24,
    marginBottom: 2,
  },
  subtitle: {
    color: colors.gray500,
    fontFamily: fonts.sans,
    fontSize: 13,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.black,
  },
  tabText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "500",
    color: colors.gray500,
  },
  tabTextActive: {
    color: colors.white,
  },
  progressBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: colors.gray50,
  },
  progressSpinner: {
    marginRight: 8,
  },
  progressText: {
    color: colors.blue600,
    fontFamily: fonts.sans,
    fontSize: 13,
  },
  staleBanner: {
    backgroundColor: colors.warningBg,
    paddingVertical: 6,
    paddingHorizontal: 24,
  },
  staleBannerText: {
    color: colors.warning,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
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
  emptyText: {
    color: colors.gray500,
    fontFamily: fonts.serif,
    fontSize: 16,
  },
  footerIndicator: {
    paddingVertical: 16,
    alignItems: "center",
  },
  footerEnd: {
    paddingVertical: 16,
    alignItems: "center",
  },
  footerEndText: {
    color: colors.gray500,
    fontFamily: fonts.sans,
    fontSize: 13,
  },
});
