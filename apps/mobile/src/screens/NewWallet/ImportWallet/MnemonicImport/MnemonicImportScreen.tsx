import React, { useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import WordInput from "./WordInput";
import type { NewWalletStackParamList } from "../../services/newWalletFlowTypes";
import { MnemonicWordCountToggle } from "./MnemonicWordCountToggle";
import {
  useMnemonicImportFlow,
  useAnalyticsFlow,
} from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useNewWalletContext } from "../../NewWalletContext";
import { colors, fonts } from "../../../../theme";
import { NOOP_ANALYTICS_PORT } from "../../../../lib/noopAnalyticsPort";

type Props = {
  navigation: NativeStackNavigationProp<
    NewWalletStackParamList,
    "MnemonicImport"
  >;
};

export default function MnemonicImportScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { addressService, ports, networkConfig } = useNewWalletContext();

  // wallet.import flow start + step("type.mnemonic")
  // on screen mount. Success emits when the screen navigates to
  // WalletName via the goToWalletName callback (= validated import).
  const { services } = useAdapters();
  const flow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "wallet.import",
  );
  useEffect(() => {
    flow.start();
    flow.step("type.mnemonic");
  }, [flow]);

  const {
    error,
    importWallet,
    isImporting,
    setSelectedWordCount,
    setWord,
    wordCount,
    words,
  } = useMnemonicImportFlow({
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
  });

  // Emit flow.error on validation failure surfaced through the flow hook.
  // The hook re-renders with `error` populated; emit once per error
  // string change so repeated renders do not flood the queue.
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      flow.error("type.mnemonic");
    } else if (!error) {
      lastErrorRef.current = null;
    }
  }, [error, flow]);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleToggleWordCount = (count: 12 | 24) => {
    if (count === wordCount) return;
    setSelectedWordCount(count);
  };

  const handleWordSelected = (index: number, word: string) => {
    setWord(index, word);
    const nextRef = inputRefs.current[index + 1];
    if (nextRef) {
      nextRef.focus();
    }
  };

  const handleSubmitEditing = (index: number) => {
    const nextRef = inputRefs.current[index + 1];
    if (nextRef) {
      nextRef.focus();
    }
  };

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

      <MnemonicWordCountToggle
        wordCount={wordCount}
        onSelect={handleToggleWordCount}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.wordGrid}>
            {words.map((word, i) => (
              <View key={`word-${wordCount}-${i}`} style={styles.wordCell}>
                <WordInput
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  index={i + 1}
                  value={word}
                  onChangeText={(text) => setWord(i, text)}
                  onWordSelected={(selected) => handleWordSelected(i, selected)}
                  onSubmitEditing={() => handleSubmitEditing(i)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.importButton, isImporting && styles.importButtonBusy]}
          onPress={importWallet}
          disabled={isImporting}
          accessibilityRole="button"
          accessibilityLabel="Import wallet"
        >
          <Text
            style={[
              styles.importButtonText,
              isImporting && styles.importButtonTextBusy,
            ]}
          >
            {isImporting ? "Scanning addresses..." : "Import"}
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  wordGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  wordCell: {
    width: "48%",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
    gap: 8,
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontFamily: fonts.serif,
    textAlign: "center",
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
