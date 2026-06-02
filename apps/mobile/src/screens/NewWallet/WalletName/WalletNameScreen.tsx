import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useWalletNameFlow, useAnalyticsFlow } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import type { NewWalletStackParamList } from "../services/newWalletFlowTypes";
import { colors, fonts, cardShadow } from "../../../theme";
import { NOOP_ANALYTICS_PORT } from "../../../lib/noopAnalyticsPort";

type Props = {
  navigation: NativeStackNavigationProp<NewWalletStackParamList, "WalletName">;
  route: RouteProp<NewWalletStackParamList, "WalletName">;
};

export default function WalletNameScreen({ navigation, route }: Props) {
  const { walletId, address, walletType } = route.params;

  // wallet.create flow start trigger. Mounting this
  // screen marks the user committing to a new wallet; useAnalyticsFlow
  // callbacks no-op internally when consent is not granted.
  const { services } = useAdapters();
  const flow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "wallet.create",
  );
  useEffect(() => {
    flow.start();
  }, [flow]);

  const { continueToSetupSuccess, error, setWalletName, walletName } =
    useWalletNameFlow({
      navigation: {
        goToSetupSuccess: (nextWalletId, nextWalletName, nextAddress) =>
          navigation.navigate("SetupSuccess", {
            walletId: nextWalletId,
            walletName: nextWalletName,
            address: nextAddress,
          }),
      },
      walletId,
      address,
      walletType,
    });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Name your wallet</Text>
        <Text style={styles.subtitle}>
          Give this wallet a name so you can identify it in your wallet list.
        </Text>

        <View style={styles.inputBox}>
          <Text style={styles.inputLabel}>Wallet name</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={walletName}
            onChangeText={setWalletName}
            placeholder="e.g. Wallet 1"
            placeholderTextColor={colors.gray500}
            autoFocus
            autoCorrect={false}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={continueToSetupSuccess}
          />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={continueToSetupSuccess}
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  title: {
    color: colors.black,
    fontSize: 28,
    fontFamily: fonts.sansBold,
  },
  subtitle: {
    color: colors.gray600,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.serif,
  },
  inputBox: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 6,
    marginTop: 8,
    ...cardShadow,
  },
  inputLabel: {
    color: colors.gray500,
    fontSize: 12,
    fontFamily: fonts.sansSemiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    color: colors.black,
    fontSize: 18,
    fontFamily: fonts.sansSemiBold,
    padding: 0,
  },
  inputError: {
    color: colors.error,
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
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.serif,
  },
  button: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: {
    color: colors.black,
    fontSize: 18,
    fontFamily: fonts.sansSemiBold,
  },
});
