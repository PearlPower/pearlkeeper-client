import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SendStackParamList } from "./SendNavigator";
import { useSendFlow } from "./SendFlowContext";
import { SendReviewSummary } from "./components/SendReviewSummary";
import { colors, fonts } from "../../theme";

export default function SendReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<SendStackParamList, "SendReview">
    >();
  const hasNavigatedRef = useRef(false);
  const {
    amountDisplay,
    analyticsFlow,
    canRetry,
    canSend,
    confirmSend,
    errorMessage,
    estimatedFeeDisplay,
    feeTierLabel,
    isBroadcasting,
    isInitializing,
    isBalanceLoading,
    recipientAddress,
    recipientAmountDisplay,
    remainingBalanceSats,
    remainingDisplay,
    retrySend,
    showRecipientAmount,
    totalDeductedDisplay,
    txid,
  } = useSendFlow();

  // tx.send sub-step on mount.
  const reviewOpenedEmittedRef = useRef(false);
  useEffect(() => {
    if (reviewOpenedEmittedRef.current) return;
    reviewOpenedEmittedRef.current = true;
    analyticsFlow.step("review.opened");
  }, [analyticsFlow]);

  // emit `signed` + `broadcast` sub-steps and
  // flow.success when txid arrives. The two steps fire together
  // because the underlying useSendBroadcast hook collapses the
  // sign + broadcast call into a single callback (`confirmSend`)
  // that returns once the txid is known.
  useEffect(() => {
    if (txid && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      analyticsFlow.step("signed");
      analyticsFlow.step("broadcast");
      analyticsFlow.success();
      navigation.navigate("SendSuccess");
    }
  }, [analyticsFlow, txid, navigation]);

  // flow.error on broadcast failure surfaced via
  // errorMessage (one emit per error transition).
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (errorMessage && errorMessage !== lastErrorRef.current) {
      lastErrorRef.current = errorMessage;
      analyticsFlow.error("broadcast");
    } else if (!errorMessage) {
      lastErrorRef.current = null;
    }
  }, [analyticsFlow, errorMessage]);

  const isLoading = isInitializing || isBalanceLoading;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        disabled={isBroadcasting}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text
          style={[
            styles.backButtonText,
            isBroadcasting && styles.backButtonDisabled,
          ]}
        >
          ← Back
        </Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 56 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Review Transaction</Text>
        <Text style={styles.stepLabel}>
          Confirm details before broadcasting
        </Text>

        <SendReviewSummary
          amountDisplay={amountDisplay}
          estimatedFeeDisplay={estimatedFeeDisplay}
          feeTierLabel={feeTierLabel}
          isLoading={isLoading}
          recipientAddress={recipientAddress}
          recipientAmountDisplay={recipientAmountDisplay}
          remainingBalanceSats={remainingBalanceSats}
          remainingDisplay={remainingDisplay}
          showRecipientAmount={showRecipientAmount}
          totalDeductedDisplay={totalDeductedDisplay}
        />

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <TouchableOpacity
            style={[
              styles.retryButton,
              !canRetry && styles.retryButtonDisabled,
            ]}
            onPress={() => {
              void retrySend();
            }}
            disabled={!canRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry broadcast"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!canSend || isBroadcasting) && styles.confirmButtonDisabled,
            ]}
            onPress={() => {
              void confirmSend();
            }}
            disabled={!canSend || isBroadcasting}
            accessibilityRole="button"
            accessibilityLabel="Confirm and broadcast transaction"
          >
            {!canSend || isBroadcasting ? (
              <ActivityIndicator color={colors.gray500} size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm & Send</Text>
            )}
          </TouchableOpacity>
        )}
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
  backButtonDisabled: {
    opacity: 0.4,
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
  errorCard: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 10,
    padding: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.sans,
  },
  confirmButton: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    minHeight: 52,
    justifyContent: "center",
  },
  confirmButtonDisabled: {
    borderColor: colors.gray300,
  },
  confirmButtonText: {
    color: colors.black,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
  retryButton: {
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  retryButtonDisabled: {
    opacity: 0.5,
  },
  retryButtonText: {
    color: colors.error,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
});
