import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useWalletListStore } from "../../store/walletListStore";
import type { WalletRecord, WalletType } from "../../store/walletListStore";
import { RootStackParamList } from "../../navigation/types";
import { createServicePorts } from "../../services/adapters/createServicePorts";
import { getBlockbookClient } from "../../services/blockbookClient";
import { useWalletServices } from "@prl-wallet/app-flows";
import { BLOCKCHAINS } from "@prl-wallet/config";
import { colors, fonts, cardShadow } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "WalletList">;
};

function getNetworkInfo(networkId: string): {
  blockchainName: string;
  networkName: string;
  isTestnet: boolean;
} {
  for (const bc of BLOCKCHAINS) {
    const net = bc.networks.find((n) => n.id === networkId);
    if (net) {
      return {
        blockchainName: bc.name,
        networkName: net.name,
        isTestnet: net.name.toLowerCase().includes("testnet"),
      };
    }
  }
  return {
    blockchainName: "Unknown",
    networkName: "Unknown",
    isTestnet: false,
  };
}

function satoshisToDisplay(sats?: string): string {
  if (!sats) return "—";
  const n = parseInt(sats, 10);
  if (isNaN(n)) return "—";
  return (n / 100_000_000).toFixed(8).replace(/\.?0+$/, "");
}

type WalletCardProps = {
  wallet: WalletRecord;
  isRefreshing: boolean;
  navigation: NativeStackNavigationProp<RootStackParamList, "WalletList">;
  walletType: WalletType | undefined;
};

function toWalletReference(
  wallet: { id: string; networkId: string },
  walletType: WalletType,
) {
  if (walletType === "xpub") {
    return {
      walletId: wallet.id,
      networkId: wallet.networkId,
      walletType,
      capability: "watchOnly" as const,
    };
  }

  return {
    walletId: wallet.id,
    networkId: wallet.networkId,
    walletType,
    capability: "signing" as const,
  };
}

function WalletCard({
  wallet,
  isRefreshing,
  navigation,
  walletType,
}: WalletCardProps) {
  const { blockchainName, isTestnet } = getNetworkInfo(wallet.networkId);
  const balanceDisplay = satoshisToDisplay(wallet.lastKnownBalance);
  const hasBalance = wallet.lastKnownBalance !== undefined;

  // type-specific badges. While walletType is loading
  // (undefined), render no badge — UI-SPEC §"Loading behavior" Lock #9.
  // Copy is verbatim per UI-SPEC §Copywriting (Lock #10):
  // mnemonic → "Mnemonic" (gray neutral)
  // bip32Seed → "BIP32" (gray neutral)
  // xpub → "Watch-only" (warning palette, hyphenated)
  let typeBadge: React.ReactNode = null;
  if (walletType === "xpub") {
    typeBadge = (
      <View style={styles.watchOnlyBadge}>
        <Text style={styles.watchOnlyBadgeText}>Watch-only</Text>
      </View>
    );
  } else if (walletType === "bip32Seed") {
    typeBadge = (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>BIP32</Text>
      </View>
    );
  } else if (walletType === "mnemonic") {
    typeBadge = (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Mnemonic</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("WalletDetail", { walletId: wallet.id })
      }
      accessibilityRole="button"
      accessibilityLabel={`Open wallet ${wallet.name}`}
    >
      <View style={styles.cardRow}>
        <Text style={styles.walletName} numberOfLines={1}>
          {wallet.name}
        </Text>
        {typeBadge}
      </View>

      <View style={[styles.cardRow, styles.cardRowGap]}>
        <Text style={styles.blockchainName}>{blockchainName}</Text>
        {isTestnet ? (
          <View style={styles.testnetBadge}>
            <Text style={styles.testnetBadgeText}>Testnet</Text>
          </View>
        ) : (
          <View style={styles.mainnetBadge}>
            <Text style={styles.mainnetBadgeText}>Mainnet</Text>
          </View>
        )}
      </View>

      <View style={[styles.cardRow, styles.cardRowGap]}>
        <Text style={styles.balanceText}>
          {hasBalance ? `${blockchainName} ${balanceDisplay}` : "—"}
        </Text>
        {(isRefreshing || !hasBalance) && (
          <ActivityIndicator
            size="small"
            color={hasBalance ? colors.blue600 : colors.gray500}
            style={styles.balanceLoader}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function WalletListScreen({ navigation }: Props) {
  const wallets = useWalletListStore((s) => s.wallets);
  const walletBalanceRefreshState = useWalletListStore(
    (s) => s.walletBalanceRefreshState,
  );
  const pendingOpenWalletId = useWalletListStore((s) => s.pendingOpenWalletId);
  const setPendingOpenWalletId = useWalletListStore(
    (s) => s.setPendingOpenWalletId,
  );
  const setWalletBalanceRefreshing = useWalletListStore(
    (s) => s.setWalletBalanceRefreshing,
  );
  const updateWalletBalance = useWalletListStore((s) => s.updateWalletBalance);
  const { addressService } = useWalletServices();
  const insets = useSafeAreaInsets();
  const ports = React.useMemo(() => createServicePorts(), []);
  // async-resolved walletType per wallet.id, used for the
  // type-specific badges in WalletCard. While loading (entry undefined),
  // the card renders no badge — UI-SPEC Lock #9.
  const [walletTypes, setWalletTypes] = useState<
    Record<string, WalletType | undefined>
  >({});
  const walletRefreshTargets = wallets.map(({ id, networkId }) => ({
    id,
    networkId,
  }));
  const walletRefreshKey = walletRefreshTargets
    .map((wallet) => `${wallet.id}:${wallet.networkId}`)
    .join("|");

  useEffect(() => {
    if (pendingOpenWalletId) {
      setPendingOpenWalletId(null);
      navigation.reset({
        index: 1,
        routes: [
          { name: "WalletList" },
          { name: "WalletDetail", params: { walletId: pendingOpenWalletId } },
        ],
      });
    }
  }, [pendingOpenWalletId]);

  useEffect(() => {
    let cancelled = false;

    async function refreshWalletBalances() {
      await Promise.all(
        walletRefreshTargets.map(async (wallet) => {
          setWalletBalanceRefreshing(wallet.id, true);

          try {
            const walletType = await ports.secrets.getWalletType(wallet.id);
            if (!walletType) {
              return;
            }

            // cache walletType for badge rendering.
            if (!cancelled) {
              setWalletTypes((prev) =>
                prev[wallet.id] === walletType
                  ? prev
                  : { ...prev, [wallet.id]: walletType },
              );
            }

            const discovery = await addressService.discoverAddresses({
              wallet: toWalletReference(wallet, walletType),
            });
            const client = getBlockbookClient(wallet.networkId);
            const balances = await Promise.all(
              discovery.derivedAddresses.map((address) =>
                client.getAddress(address.address, 1, 1),
              ),
            );
            const confirmed = balances.reduce(
              (sum, result) => sum + BigInt(result.balance),
              0n,
            );

            if (!cancelled) {
              updateWalletBalance(wallet.id, confirmed.toString());
            }
          } catch {
            return;
          } finally {
            if (!cancelled) {
              setWalletBalanceRefreshing(wallet.id, false);
            }
          }
        }),
      );
    }

    if (walletRefreshTargets.length > 0) {
      void refreshWalletBalances();
    }

    return () => {
      cancelled = true;
    };
  }, [
    addressService,
    ports,
    setWalletBalanceRefreshing,
    updateWalletBalance,
    walletRefreshKey,
  ]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>My Wallets</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={styles.headerButton}
          >
            <Text style={styles.gearText}>&#9881;</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("NewWalletFlow")}
            accessibilityRole="button"
            accessibilityLabel="Add wallet"
            style={styles.headerButton}
          >
            <Text style={styles.plusText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {wallets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No wallets yet</Text>
            <Text style={styles.emptySubtext}>
              Tap + to add your first wallet
            </Text>
          </View>
        ) : (
          wallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              isRefreshing={Boolean(walletBalanceRefreshState[wallet.id])}
              wallet={wallet}
              navigation={navigation}
              walletType={walletTypes[wallet.id]}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    color: colors.black,
    fontFamily: fonts.displayLight,
    fontSize: 28,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  gearText: {
    color: colors.gray500,
    fontSize: 20,
  },
  plusText: {
    color: colors.blue600,
    fontFamily: fonts.sans,
    fontSize: 24,
    lineHeight: 26,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    ...cardShadow,
    padding: 16,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardRowGap: {
    marginTop: 8,
    gap: 8,
  },
  walletName: {
    flex: 1,
    color: colors.black,
    fontFamily: fonts.sansBold,
    fontSize: 18,
    marginRight: 8,
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
  blockchainName: {
    color: colors.gray500,
    fontFamily: fonts.sans,
    fontSize: 13,
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
  // Mainnet pill (success palette; mutually exclusive
  // with the Testnet pill on the same row). UI-SPEC Lock #5 — green family.
  mainnetBadge: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  mainnetBadgeText: {
    color: colors.success,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
  },
  // Watch-only badge (warning palette). UI-SPEC Lock #4 —
  // "be aware" cue, NOT destructive (colors.error reserved for delete-flow).
  watchOnlyBadge: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  watchOnlyBadgeText: {
    color: colors.warning,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
  },
  balanceText: {
    color: colors.gray600,
    fontFamily: fonts.serif,
    fontSize: 14,
  },
  balanceLoader: {
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    color: colors.black,
    fontFamily: fonts.sansSemiBold,
    fontSize: 18,
  },
  emptySubtext: {
    color: colors.gray500,
    fontFamily: fonts.serif,
    fontSize: 14,
  },
});
