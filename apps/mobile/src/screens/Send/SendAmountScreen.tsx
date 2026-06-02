import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { formatFiat } from "@prl-wallet/app-flows";
import type { SendStackParamList } from "./SendNavigator";
import { useSendFlow } from "./SendFlowContext";
import { colors, fonts } from "../../theme";

export default function SendAmountScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<SendStackParamList, "SendAmount">
    >();
  const {
    amountError,
    amountSats,
    amountText,
    analyticsFlow,
    handleAmountTextChange,
    handleSliderChange,
    isBalanceLoading,
    priceUsd,
    priceIsStale,
    sliderPercent,
    spendableDisplay,
    validateAmount,
  } = useSendFlow();

  // fiat sublabel below the native amount input.
  // Math: (amountSats / 1e8) * priceUsd. Null usd collapses to "≈ —"
  // via formatFiat ( em-dash unavailable token).
  const fiatSublabel =
    priceUsd == null
      ? "≈ —"
      : formatFiat((Number(amountSats) / 1e8) * priceUsd);

  function handleNext() {
    if (validateAmount()) {
      // tx.send sub-step.
      analyticsFlow.step("amount.entered");
      navigation.navigate("SendFee");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 56 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Send PRL</Text>
        <Text style={styles.stepLabel}>Step 2 of 3 — Amount</Text>

        <Text style={styles.instruction}>
          {isBalanceLoading
            ? "Loading your balance…"
            : `You have ${spendableDisplay} available. Enter how much you'd like to send.`}
        </Text>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Amount (PRL)</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.0"
            placeholderTextColor={colors.gray500}
            value={amountText}
            onChangeText={handleAmountTextChange}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />

          {/* — fiat sublabel below the amount input.
              Re-renders on every keystroke via amountSats subscription.
               stale indicator: dim opacity + (stale) suffix. */}
          <Text
            style={[styles.fiatSublabel, priceIsStale && styles.staleIndicator]}
            accessibilityLabel="Approximate fiat value"
          >
            {fiatSublabel}
            {priceIsStale ? " (stale)" : ""}
          </Text>

          {amountError ? (
            <Text style={styles.errorText}>{amountError}</Text>
          ) : null}
        </View>

        <View style={styles.sliderSection}>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>0%</Text>
            <Text style={styles.sliderPercent}>
              {sliderPercent.toFixed(0)}%
            </Text>
            <Text style={styles.sliderLabel}>100%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            step={0}
            value={sliderPercent}
            onValueChange={handleSliderChange}
            minimumTrackTintColor={colors.blue600}
            maximumTrackTintColor={colors.gray300}
            thumbTintColor={colors.blue600}
          />
        </View>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel="Next"
        >
          <Text style={styles.nextButtonText}>Next →</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 16,
    zIndex: 10,
  },
  backButtonText: {
    color: colors.blue600,
    fontSize: 15,
    fontFamily: fonts.sans,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 20,
  },
  title: {
    color: colors.black,
    fontSize: 22,
    fontFamily: fonts.sansBold,
    alignSelf: "center",
  },
  stepLabel: {
    color: colors.gray500,
    fontSize: 13,
    textAlign: "center",
    fontFamily: fonts.sans,
  },
  instruction: {
    color: colors.gray600,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.serif,
  },
  inputSection: {
    gap: 8,
  },
  inputLabel: {
    color: colors.gray500,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.sansSemiBold,
  },
  amountInput: {
    color: colors.black,
    fontSize: 24,
    fontFamily: fonts.sansSemiBold,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    textAlign: "center",
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  // fiat sublabel styling. Muted color for low-key
  // annotation; opacity 0.7 communicates the stale state per .
  fiatSublabel: {
    color: colors.gray500,
    fontSize: 14,
    fontFamily: fonts.sans,
    textAlign: "center",
    marginTop: 4,
  },
  staleIndicator: {
    opacity: 0.7,
  },
  sliderSection: {
    gap: 8,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderLabel: {
    color: colors.gray500,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  sliderPercent: {
    color: colors.blue600,
    fontSize: 14,
    fontFamily: fonts.sansSemiBold,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  nextButton: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  nextButtonText: {
    color: colors.black,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
});
