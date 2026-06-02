import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { NewWalletStackParamList } from "../../services/newWalletFlowTypes";
import { XpubPreviewCard } from "./XpubPreviewCard";
import { useXpubImportFlow, useAnalyticsFlow } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useNewWalletContext } from "../../NewWalletContext";
import { colors, fonts } from "../../../../theme";
import { NOOP_ANALYTICS_PORT } from "../../../../lib/noopAnalyticsPort";

type Props = {
  navigation: NativeStackNavigationProp<NewWalletStackParamList, "XpubImport">;
};

export default function XpubImportScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { addressService, ports, networkConfig, network } =
    useNewWalletContext();

  // wallet.import flow start + step("type.xpub").
  const { services } = useAdapters();
  const flow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "wallet.import",
  );
  useEffect(() => {
    flow.start();
    flow.step("type.xpub");
  }, [flow]);

  const {
    error,
    extendedPubKeyPrefix,
    importWallet,
    isImporting,
    previewAddress,
    setXpub,
    xpub,
  } = useXpubImportFlow({
    navigation: {
      goToWalletName: (walletId, address, walletType) => {
        flow.step("validation.passed");
        flow.success();
        navigation.navigate("WalletName", { walletId, address, walletType });
      },
    },
    addressService,
    ports,
    networkId: networkConfig.id,
    network,
    extendedPubKeyPrefix: networkConfig.extendedPubKeyPrefix,
  });

  // Emit flow.error on validation failure surfaced through the hook.
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      flow.error("type.xpub");
    } else if (!error) {
      lastErrorRef.current = null;
    }
  }, [error, flow]);

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Watch-only Wallet</Text>
        <Text style={styles.subtitle}>
          Add a watch-only wallet using an extended public key.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={xpub}
            onChangeText={(text) => {
              setXpub(text);
            }}
            placeholder={`Enter your ${extendedPubKeyPrefix}...`}
            placeholderTextColor={colors.gray500}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <Text style={styles.inputHelperText}>
            Enter the account-level {extendedPubKeyPrefix} for the selected
            network. Find it in your wallet's settings or export options.
          </Text>
        </View>

        <XpubPreviewCard previewAddress={previewAddress} />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.importButton, isImporting && styles.importButtonBusy]}
          onPress={importWallet}
          disabled={isImporting}
          accessibilityRole="button"
          accessibilityLabel="Add watch-only wallet"
        >
          <Text
            style={[
              styles.importButtonText,
              isImporting && styles.importButtonTextBusy,
            ]}
          >
            {isImporting ? "Scanning addresses..." : "Add watch-only wallet"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButtonText: {
    color: colors.blue600,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  title: {
    color: colors.black,
    fontSize: 26,
    fontFamily: fonts.displayLight,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.gray500,
    fontSize: 14,
    fontFamily: fonts.serif,
    lineHeight: 20,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputHelperText: {
    color: colors.gray500,
    fontSize: 12,
    fontFamily: fonts.serif,
    lineHeight: 17,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: colors.black,
    fontSize: 15,
    fontFamily: fonts.serif,
    minHeight: 80,
    textAlignVertical: "top",
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontFamily: fonts.serif,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
  },
  importButton: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  importButtonBusy: {
    borderColor: colors.gray300,
  },
  importButtonText: {
    color: colors.black,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
  importButtonTextBusy: {
    color: colors.gray500,
  },
});
