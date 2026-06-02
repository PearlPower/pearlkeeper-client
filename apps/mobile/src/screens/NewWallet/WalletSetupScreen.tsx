import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { generateMnemonic } from "@prl-wallet/core";
import {
  BLOCKCHAINS,
  BlockchainConfig,
  NetworkConfig,
} from "@prl-wallet/config";
import type { NewWalletStackParamList } from "./services/newWalletFlowTypes";
import { useNewWalletContext } from "./NewWalletContext";
import { useWalletListStore } from "../../store/walletListStore";
import { colors, fonts, cardShadow } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<NewWalletStackParamList, "WalletSetup">;
};

export default function WalletSetupScreen({ navigation }: Props) {
  const [mnemonic] = useState<string>(() => generateMnemonic(128));
  const hasWallets = useWalletListStore((s) => s.wallets.length > 0);
  const [selectedBlockchain, setSelectedBlockchain] =
    useState<BlockchainConfig>(BLOCKCHAINS[0]);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfig>(
    BLOCKCHAINS[0].networks[0],
  );

  const { setChain } = useNewWalletContext();

  const handleChainSelect = (bc: BlockchainConfig, net: NetworkConfig) => {
    setSelectedBlockchain(bc);
    setSelectedNetwork(net);
    setChain(bc, net);
  };

  return (
    <View style={styles.container}>
      {hasWallets && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to wallets list"
        >
          <Text style={styles.backButtonText}>← Wallets</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title}>Set up your wallet</Text>
      <Text style={styles.subtitle}>Choose how you want to get started</Text>

      {/* Blockchain selector — only shown when multiple blockchains exist */}
      {BLOCKCHAINS.length > 1 && (
        <View style={styles.segmentedControl}>
          {BLOCKCHAINS.map((bc) => (
            <TouchableOpacity
              key={bc.id}
              style={[
                styles.segmentButton,
                selectedBlockchain.id === bc.id && styles.segmentButtonActive,
              ]}
              onPress={() => handleChainSelect(bc, bc.networks[0])}
              accessibilityRole="button"
              accessibilityLabel={bc.name}
              accessibilityState={{ selected: selectedBlockchain.id === bc.id }}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  selectedBlockchain.id === bc.id &&
                    styles.segmentButtonTextActive,
                ]}
              >
                {bc.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Network selector — only shown when selected blockchain has multiple networks */}
      {selectedBlockchain.networks.length > 1 && (
        <View style={styles.segmentedControl}>
          {selectedBlockchain.networks.map((net) => (
            <TouchableOpacity
              key={net.id}
              style={[
                styles.segmentButton,
                selectedNetwork.id === net.id && styles.segmentButtonActive,
              ]}
              onPress={() => handleChainSelect(selectedBlockchain, net)}
              accessibilityRole="button"
              accessibilityLabel={net.name}
              accessibilityState={{ selected: selectedNetwork.id === net.id }}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  selectedNetwork.id === net.id &&
                    styles.segmentButtonTextActive,
                ]}
              >
                {net.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Primary actions */}
      <View style={styles.primaryButtons}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("SeedPhrase", { mnemonic })}
          accessibilityRole="button"
          accessibilityLabel="Create new wallet"
        >
          <Text style={styles.primaryButtonText}>Create new wallet</Text>
          <Text style={styles.primaryButtonSubtext}>
            Generate a fresh 12-word seed phrase
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("MnemonicImport")}
          accessibilityRole="button"
          accessibilityLabel="Import via seed phrase"
        >
          <Text style={styles.primaryButtonText}>Import via seed phrase</Text>
          <Text style={styles.primaryButtonSubtext}>
            Enter your 12 or 24-word recovery phrase
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("BIP32SeedImport")}
          accessibilityRole="button"
          accessibilityLabel="Import via BIP32 seed"
        >
          <Text style={styles.primaryButtonText}>Import via BIP32 seed</Text>
          <Text style={styles.primaryButtonSubtext}>
            Enter a 128-char hex seed or {selectedNetwork.extendedKeyPrefix} key
          </Text>
        </TouchableOpacity>
      </View>

      {/* Secondary action */}
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate("XpubImport")}
        accessibilityRole="button"
        accessibilityLabel="Watch-only xpub"
      >
        <Text style={styles.secondaryButtonText}>Watch-only (xpub)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: colors.blue600,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
  },
  title: {
    color: colors.black,
    fontSize: 28,
    fontFamily: fonts.sansBold,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.gray600,
    fontSize: 15,
    marginBottom: 16,
    fontFamily: fonts.serif,
  },
  segmentedControl: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: colors.black,
  },
  segmentButtonText: {
    color: colors.gray500,
    fontSize: 14,
    fontFamily: fonts.sansSemiBold,
  },
  segmentButtonTextActive: {
    color: colors.white,
  },
  primaryButtons: {
    gap: 12,
    flex: 1,
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    ...cardShadow,
  },
  primaryButtonText: {
    color: colors.black,
    fontSize: 17,
    fontFamily: fonts.sansBold,
    marginBottom: 4,
  },
  primaryButtonSubtext: {
    color: colors.gray600,
    fontSize: 13,
    fontFamily: fonts.serif,
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: colors.gray500,
    fontSize: 14,
    fontFamily: fonts.sans,
  },
});
