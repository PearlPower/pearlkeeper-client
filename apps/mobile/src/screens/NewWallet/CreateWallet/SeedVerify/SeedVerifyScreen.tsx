import React, { useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import type { NewWalletStackParamList } from "../../services/newWalletFlowTypes";
import { useSeedVerifyFlow, useAnalyticsFlow } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useNewWalletContext } from "../../NewWalletContext";
import { colors, fonts } from "../../../../theme";
import { NOOP_ANALYTICS_PORT } from "../../../../lib/noopAnalyticsPort";

type Props = {
  navigation: NativeStackNavigationProp<NewWalletStackParamList, "SeedVerify">;
  route: RouteProp<NewWalletStackParamList, "SeedVerify">;
};

export default function SeedVerifyScreen({ navigation, route }: Props) {
  const { mnemonic } = route.params;
  const insets = useSafeAreaInsets();
  const { ports, network, bip86Path, networkConfig } = useNewWalletContext();

  // wallet.create flow step + success instrumentation.
  // Mount of this screen marks `mnemonic.shown`; after a successful
  // verify we emit `mnemonic.verified` and `flow.success()` (the
  // navigation transition to WalletName indicates verification passed).
  const { services } = useAdapters();
  const flow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "wallet.create",
  );
  const mnemonicShownEmittedRef = useRef(false);
  useEffect(() => {
    if (mnemonicShownEmittedRef.current) return;
    mnemonicShownEmittedRef.current = true;
    flow.step("mnemonic.shown");
  }, [flow]);

  const seedVerify = useSeedVerifyFlow({
    navigation: {
      goToWalletName: (walletId, address, walletType) => {
        flow.step("mnemonic.verified");
        flow.success();
        navigation.navigate("WalletName", {
          walletId,
          address,
          walletType,
        });
      },
    },
    mnemonic,
    ports,
    network,
    bip86Path,
    networkId: networkConfig.id,
  });
  const {
    challenge,
    selections,
    error,
    isVerifying,
    allSelected,
    handleSelect,
    handleVerify,
  } = seedVerify;

  // Emit a flow.error if the user backs out of seed verify (cancel path
  // per — "back/cancel from any sub-screen" is the wallet.create
  // error trigger). The first goBack press fires the error event; the
  // navigation goBack continues unchanged.
  const errorEmittedRef = useRef(false);
  const handleBack = useCallback(() => {
    if (!errorEmittedRef.current) {
      errorEmittedRef.current = true;
      flow.error("mnemonic.shown");
    }
    navigation.goBack();
  }, [flow, navigation]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="Back to seed phrase"
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Verify your seed phrase</Text>
          <Text style={styles.subtitle}>
            Select the correct word for each numbered position
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.blanksContainer}>
          {challenge.blanks.map((blank) => (
            <View key={blank.position} style={styles.blankItem}>
              <Text style={styles.blankLabel}>Word #{blank.position + 1}</Text>
              <View style={styles.choicesRow}>
                {blank.choices.map((choice) => {
                  const isSelected = selections[blank.position] === choice;
                  return (
                    <TouchableOpacity
                      key={choice}
                      style={[
                        styles.choiceButton,
                        isSelected && styles.choiceButtonSelected,
                      ]}
                      onPress={() => handleSelect(blank.position, choice)}
                      accessibilityRole="button"
                      accessibilityLabel={choice}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          isSelected && styles.choiceTextSelected,
                        ]}
                      >
                        {choice}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.backHint}>
          Forgot a word? Tap ← Back above to see your seed phrase.
        </Text>

        <TouchableOpacity
          style={[
            styles.verifyButton,
            (!allSelected || isVerifying) && styles.verifyButtonDisabled,
          ]}
          onPress={handleVerify}
          disabled={!allSelected || isVerifying}
          accessibilityRole="button"
          accessibilityLabel="Verify"
          accessibilityState={{ disabled: !allSelected || isVerifying }}
        >
          <Text
            style={[
              styles.verifyButtonText,
              (!allSelected || isVerifying) && styles.verifyButtonTextDisabled,
            ]}
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    color: colors.black,
    fontSize: 26,
    fontFamily: fonts.sansBold,
  },
  subtitle: {
    color: colors.gray600,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.serif,
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
    fontFamily: fonts.sansSemiBold,
  },
  blanksContainer: {
    gap: 20,
  },
  blankItem: {
    gap: 10,
  },
  blankLabel: {
    color: colors.black,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
  },
  choicesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceButton: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  choiceButtonSelected: {
    borderColor: colors.black,
    backgroundColor: colors.gray50,
  },
  choiceText: {
    color: colors.gray600,
    fontSize: 14,
    fontFamily: fonts.sans,
  },
  choiceTextSelected: {
    color: colors.black,
    fontFamily: fonts.sansSemiBold,
  },
  verifyButton: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  verifyButtonDisabled: {
    borderColor: colors.gray300,
  },
  verifyButtonText: {
    color: colors.black,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
  verifyButtonTextDisabled: {
    color: colors.gray500,
  },
  backHint: {
    color: colors.gray500,
    fontSize: 13,
    textAlign: "center",
    marginTop: 16,
    fontFamily: fonts.serif,
  },
});
