import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { CommonActions, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useWalletDetailFlow } from "@prl-wallet/app-flows";
import { RootStackParamList } from "../../navigation/types";
import { WalletDetailActions } from "./components/WalletDetailActions";
import { WalletDetailHeader } from "./components/WalletDetailHeader";
import { WalletDetailOptionsSheet } from "./components/WalletDetailOptionsSheet";
import { colors } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "WalletDetail">;
  route: RouteProp<RootStackParamList, "WalletDetail">;
};

export default function WalletDetailScreen({ navigation, route }: Props) {
  const { walletId } = route.params;
  const {
    addresses,
    deleteWallet,
    hasMultipleAddresses,
    isDiscovering,
    isRefreshing,
    networkId,
    openAddressList,
    openReceive,
    openSend,
    openTransactionHistory,
    persistBalance,
    refresh,
    usedAddressCount,
    wallet,
    walletType,
  } = useWalletDetailFlow({
    walletId,
    navigation: {
      goToSend: (id) => navigation.navigate("SendFlow", { walletId: id }),
      goToReceive: (id) => navigation.navigate("Receive", { walletId: id }),
      goToTransactionList: (addrs) =>
        navigation.navigate("TransactionList", { addresses: addrs }),
      goToAddressList: (derivedAddresses) =>
        navigation.navigate("AddressList", { derivedAddresses }),
      goBack: () => navigation.goBack(),
      popToTop: () => navigation.popToTop(),
      resetToRoot: () =>
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "Welcome" }] }),
        ),
    },
  });

  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // useWalletDetailFlow returns networkId: null while the wallet record
  // hasn't loaded. Navigation invariant guarantees the wallet exists by the
  // time the user reaches this screen — render nothing until the flow
  // resolves rather than falling back to a hardcoded network id (which
  // could be disabled in blockchains.json).
  if (!wallet || !networkId) {
    return null;
  }

  async function handleDeleteConfirm() {
    setShowDeleteModal(false);
    await deleteWallet();
  }

  function handleOpenWalletList() {
    setShowOptionsMenu(false);
    navigation.popToTop();
  }

  function handleOpenDeleteConfirmation() {
    setShowOptionsMenu(false);
    setShowDeleteModal(true);
  }

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.blue600}
            colors={[colors.blue600]}
          />
        }
      >
        <WalletDetailHeader
          networkId={networkId}
          onOpenOptionsMenu={() => setShowOptionsMenu(true)}
          walletName={wallet?.name ?? "Wallet"}
          walletType={walletType}
        />
        <WalletDetailActions
          addresses={addresses}
          hasMultipleAddresses={hasMultipleAddresses}
          initialConfirmedSats={wallet?.lastKnownBalance}
          isDiscovering={isDiscovering}
          isRefreshing={isRefreshing}
          networkId={networkId}
          onOpenAddressList={openAddressList}
          onOpenReceive={openReceive}
          onOpenSend={openSend}
          onOpenTransactionHistory={openTransactionHistory}
          onPersistBalance={persistBalance}
          usedAddressCount={usedAddressCount}
          walletType={walletType}
        />
      </ScrollView>

      <WalletDetailOptionsSheet
        deleteVisible={showDeleteModal}
        onCancelDelete={() => setShowDeleteModal(false)}
        onCloseOptionsMenu={() => setShowOptionsMenu(false)}
        onConfirmDelete={handleDeleteConfirm}
        onOpenDeleteConfirmation={handleOpenDeleteConfirmation}
        onOpenWalletList={handleOpenWalletList}
        optionsVisible={showOptionsMenu}
        walletName={wallet?.name ?? "Wallet"}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
    gap: 32,
  },
});
