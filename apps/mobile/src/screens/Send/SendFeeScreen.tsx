import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SendStackParamList } from "./SendNavigator";
import { useSendFlow } from "./SendFlowContext";
import { CustomFeeInput } from "./components/CustomFeeInput";
import { FeeTierList } from "./components/FeeTierList";
import { colors, fonts, cardShadow } from "../../theme";

export default function SendFeeScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<SendStackParamList, "SendFee">>();
  const {
    analyticsFlow,
    customError,
    customSatVbyte,
    feeTierOptions,
    feeIsStale,
    liveRates,
    loadingRates,
    priceIsStale,
    selectTier,
    selectedTier,
    setCustomSatVbyte,
    setSubtractFeeFromAmount,
    subtractFeeFromAmount,
    validateFee,
  } = useSendFlow();

  // fiat sublabel is dimmed when EITHER fee or price
  // is stale (the displayed USD value depends on both inputs).
  const fiatStale = feeIsStale || priceIsStale;

  function handleNext() {
    if (validateFee()) {
      // tx.send sub-step.
      analyticsFlow.step("fee.selected");
      navigation.navigate("SendReview");
    }
  }

  return (
    <View style={styles.container}>
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
        <Text style={styles.stepLabel}>Step 3 of 3 — Fee</Text>

        <FeeTierList
          feeTierOptions={feeTierOptions}
          liveRates={liveRates}
          loadingRates={loadingRates}
          onSelectTier={selectTier}
          selectedTier={selectedTier}
          feeIsStale={fiatStale}
        />

        {selectedTier === "custom" && (
          <CustomFeeInput
            customError={customError}
            customSatVbyte={customSatVbyte}
            onChangeText={setCustomSatVbyte}
          />
        )}

        <View style={styles.toggleRow}>
          <View style={styles.toggleLeft}>
            <Text style={styles.toggleLabel}>Subtract fee from amount</Text>
            <Text style={styles.toggleHint}>
              The fee is deducted from what you send, so the total spent equals
              the amount entered.
            </Text>
          </View>
          <Switch
            value={subtractFeeFromAmount}
            onValueChange={setSubtractFeeFromAmount}
            trackColor={{ false: colors.gray300, true: colors.blue600 }}
            thumbColor={subtractFeeFromAmount ? colors.white : colors.gray500}
          />
        </View>

        <Text style={styles.disclaimer}>
          The fee shown is an estimate based on typical transaction size. The
          actual fee may vary slightly.
        </Text>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel="Review transaction"
        >
          <Text style={styles.nextButtonText}>Review →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
    gap: 16,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...cardShadow,
  },
  toggleLeft: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    color: colors.gray700,
    fontSize: 14,
    fontFamily: fonts.sansSemiBold,
  },
  toggleHint: {
    color: colors.gray600,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.serif,
  },
  disclaimer: {
    color: colors.gray600,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    fontFamily: fonts.serif,
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
