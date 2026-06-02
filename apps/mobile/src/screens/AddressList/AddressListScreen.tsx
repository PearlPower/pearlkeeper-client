import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import {
  useAddress,
  satoshisToPrl,
  type BlockbookClientLike,
} from "@prl-wallet/api-client";
import { ListRow } from "../../components/ListRow";
import { getBlockbookClient } from "../../services/blockbookClient";
import { discoverWalletAddresses } from "../../services/discoverAddresses";
import type { DerivedAddress } from "../../services/discoverAddresses";
import { useWalletListStore } from "../../store/walletListStore";
import { getWalletType } from "../../services/secureStorage";
import { RootStackParamList } from "../../navigation/types";
import { colors, fonts } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "AddressList">;
  route: RouteProp<RootStackParamList, "AddressList">;
};

interface AddressRowProps {
  entry: DerivedAddress;
  client: BlockbookClientLike | null;
}

function AddressRow({ entry, client }: AddressRowProps) {
  const { data, isLoading } = useAddress(client, entry.address);
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");

  async function handleCopy() {
    await Clipboard.setStringAsync(entry.address);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy"), 1500);
  }

  return (
    <ListRow style={styles.addressRow}>
      <Text style={styles.indexLabel}>Address {entry.index}</Text>

      <Text style={styles.addressText} selectable>
        {entry.address}
      </Text>

      <View style={styles.rowFooter}>
        <View style={styles.balanceRow}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.blue600} />
          ) : (
            <Text style={styles.balanceText}>
              {data ? satoshisToPrl(data.balance) : "0"} PRL
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleCopy}
          style={styles.copyButton}
          accessibilityRole="button"
          accessibilityLabel={`Copy address ${entry.index}`}
        >
          <Text style={styles.copyButtonText}>{copyLabel}</Text>
        </TouchableOpacity>
      </View>
    </ListRow>
  );
}

export default function AddressListScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const wallets = useWalletListStore((s) => s.wallets);
  const activeWalletId = useWalletListStore((s) => s.activeWalletId);
  const activeWallet =
    wallets.find((w) => w.id === activeWalletId) ?? wallets[0] ?? null;
  // No hardcoded chain fallback: when no wallet is selected, the client is
  // null and downstream hooks skip the query.
  const client = activeWallet
    ? getBlockbookClient(activeWallet.networkId)
    : null;

  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [derivedAddresses, setDerivedAddresses] = useState<DerivedAddress[]>(
    route.params.derivedAddresses,
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (activeWallet && client) {
        const walletType = await getWalletType(activeWallet.id);
        const discovered = await discoverWalletAddresses(
          client,
          activeWallet.id,
          walletType,
          activeWallet.networkId,
        );
        if (discovered) {
          setDerivedAddresses(discovered.derivedAddresses);
        }
      }
    } catch {
      // Discovery failed — fall through to balance refresh
    }
    await queryClient.invalidateQueries({ queryKey: ["address"] });
    await queryClient.refetchQueries({ queryKey: ["address"], type: "active" });
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [queryClient, activeWallet, client]);

  const visibleAddresses = derivedAddresses.filter((a) => a.hasTransactions);

  const subtitle = `${visibleAddresses.length} address${visibleAddresses.length !== 1 ? "es" : ""} discovered${lastUpdated ? ` · ${lastUpdated.toLocaleTimeString()}` : ""}`;

  return (
    <View style={styles.screen}>
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Addresses</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <FlatList
        data={visibleAddresses}
        keyExtractor={(item) => item.address}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <AddressRow entry={item} client={client} />
        )}
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
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
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
  listContent: {
    paddingBottom: 24,
  },
  addressRow: {
    gap: 6,
  },
  indexLabel: {
    color: colors.gray500,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addressText: {
    color: colors.black,
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 19,
  },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 20,
  },
  balanceText: {
    color: colors.gray600,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "500",
  },
  copyButton: {
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  copyButtonText: {
    color: colors.blue600,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
  },
});
