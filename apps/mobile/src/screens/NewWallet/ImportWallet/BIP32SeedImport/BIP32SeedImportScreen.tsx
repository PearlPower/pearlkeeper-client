import React, { useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  useBip32SeedImportFlow,
  useAnalyticsFlow,
} from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import type { NewWalletStackParamList } from "../../services/newWalletFlowTypes";
import { useNewWalletContext } from "../../NewWalletContext";
import SeedInput from "./SeedInput";
import ScanLog from "./ScanLog";
import ImportButton from "./ImportButton";
import { colors, fonts } from "../../../../theme";
import { NOOP_ANALYTICS_PORT } from "../../../../lib/noopAnalyticsPort";

type Props = {
  navigation: NativeStackNavigationProp<
    NewWalletStackParamList,
    "BIP32SeedImport"
  >;
};

export default function BIP32SeedImportScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { addressService, ports, networkConfig } = useNewWalletContext();

  // wallet.import flow start + step("type.bip32seed").
  const { services } = useAdapters();
  const flow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "wallet.import",
  );
  useEffect(() => {
    flow.start();
    flow.step("type.bip32seed");
  }, [flow]);

  const {
    error,
    extendedKeyPrefix,
    importWallet,
    input,
    isImporting,
    scanLog,
    setInput,
    setShowLog,
    showLog,
  } = useBip32SeedImportFlow({
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
    extendedKeyPrefix: networkConfig.extendedKeyPrefix,
  });

  // Emit flow.error on validation failure surfaced through the hook.
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      flow.error("type.bip32seed");
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

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Import BIP32 Seed</Text>
        <Text style={styles.subtitle}>
          Enter a hex seed (64 or 128 characters) or a {extendedKeyPrefix}{" "}
          extended private key to import an existing HD wallet.
        </Text>

        <SeedInput
          value={input}
          onChange={(text) => {
            setInput(text);
          }}
          error={error}
          disabled={isImporting}
          extendedKeyPrefix={extendedKeyPrefix}
        />

        <ScanLog
          logs={scanLog}
          isOpen={showLog}
          onToggle={() => setShowLog((v) => !v)}
        />
      </ScrollView>

      <View style={styles.footer}>
        <ImportButton onPress={importWallet} isImporting={isImporting} />
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
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  title: {
    color: colors.black,
    fontSize: 26,
    fontFamily: fonts.displayLight,
  },
  subtitle: {
    color: colors.gray500,
    fontSize: 14,
    fontFamily: fonts.serif,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
  },
});
