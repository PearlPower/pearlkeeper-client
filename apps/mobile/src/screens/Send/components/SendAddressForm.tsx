import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, fonts } from "../../../theme";

type Props = {
  addressError: string | null;
  /** — permanent helper line under the input. */
  bip21HelperCaption?: string;
  /** — ephemeral 3-second hint shown after BIP21 paste. */
  pastedAmountHint?: string | null;
  recipientAddress: string;
  screenTitle: string;
  topInset: number;
  onNext: () => void;
  onOpenScanner: () => void;
  onRecipientAddressChange: (value: string) => void;
};

export function SendAddressForm({
  addressError,
  bip21HelperCaption,
  pastedAmountHint,
  recipientAddress,
  screenTitle,
  topInset,
  onNext,
  onOpenScanner,
  onRecipientAddressChange,
}: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: topInset + 56 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{screenTitle}</Text>
      <Text style={styles.stepLabel}>Step 1 of 3 — Recipient Address</Text>

      <View style={styles.inputSection} testID="send-address-form">
        <Text style={styles.inputLabel}>Recipient Address</Text>
        <TextInput
          style={styles.addressInput}
          placeholder="Enter recipient address"
          placeholderTextColor={colors.gray500}
          value={recipientAddress}
          onChangeText={onRecipientAddressChange}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          multiline
          numberOfLines={3}
          returnKeyType="done"
          blurOnSubmit
        />

        {addressError ? (
          <Text style={styles.errorText}>{addressError}</Text>
        ) : null}

        {/* — permanent helper caption (always visible). */}
        {bip21HelperCaption ? (
          <Text style={styles.helperCaption}>{bip21HelperCaption}</Text>
        ) : null}

        {/* — ephemeral pasted-amount hint (3s auto-dismiss). */}
        {pastedAmountHint ? (
          <Text style={styles.helperCaption}>{pastedAmountHint}</Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.qrButton}
        onPress={onOpenScanner}
        accessibilityRole="button"
        accessibilityLabel="Scan QR code"
      >
        <Text style={styles.qrButtonText}>Scan QR Code</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.nextButton}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Next"
      >
        <Text style={styles.nextButtonText}>Next →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 24,
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
  addressInput: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: colors.black,
    fontSize: 14,
    fontFamily: fonts.mono,
    minHeight: 90,
    textAlignVertical: "top",
  },
  qrButton: {
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
  },
  qrButtonText: {
    color: colors.black,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  // both the permanent helper caption and the ephemeral
  // pasted-amount hint use this style. UI-SPEC §Typography Lock #2.
  helperCaption: {
    color: colors.gray500,
    fontFamily: fonts.sans,
    fontSize: 13,
    marginTop: 8,
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
