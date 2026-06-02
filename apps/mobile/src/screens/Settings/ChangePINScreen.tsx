import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAnalyticsFlow } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import PINPad from "../../components/PINPad";
import {
  createPinRecord,
  getPinHash,
  storePinHash,
  verifyPin,
} from "../../services/secureStorage";
import { useLockStore } from "../../store/lockStore";
import { RootStackParamList } from "../../navigation/types";
import { colors, fonts } from "../../theme";
import { NOOP_ANALYTICS_PORT } from "../../lib/noopAnalyticsPort";

type Step = "verify" | "enter-new" | "confirm-new" | "success";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "ChangePIN">;
};

export default function ChangePINScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { failedAttempts, lockUntil, recordFailedAttempt, resetAttempts } =
    useLockStore();

  // pin.change flow start on mount; success on confirm
  // success; error on mismatch / abort.
  const { services } = useAdapters();
  const flow = useAnalyticsFlow(
    services.analytics ?? NOOP_ANALYTICS_PORT,
    "pin.change",
  );
  useEffect(() => {
    flow.start();
  }, [flow]);

  const [step, setStep] = useState<Step>("verify");
  const [shake, setShake] = useState(false);
  const [newPIN, setNewPIN] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (shake) {
      const timer = setTimeout(() => setShake(false), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [shake]);

  const handleVerify = useCallback(
    async (enteredPIN: string) => {
      try {
        const storedHash = await getPinHash();
        if (!storedHash) {
          resetAttempts();
          setStep("enter-new");
          return;
        }
        if (await verifyPin(enteredPIN, storedHash)) {
          resetAttempts();
          setStep("enter-new");
        } else {
          recordFailedAttempt();
          setShake(true);
        }
      } catch {
        recordFailedAttempt();
        setShake(true);
      }
    },
    [recordFailedAttempt, resetAttempts],
  );

  const handleEnterNew = useCallback((pin: string) => {
    setNewPIN(pin);
    setConfirmError(null);
    setStep("confirm-new");
  }, []);

  const handleConfirm = useCallback(
    async (confirmedPIN: string) => {
      if (confirmedPIN !== newPIN) {
        setConfirmError("PINs do not match. Try again.");
        setNewPIN("");
        setStep("enter-new");
        // pin.change error trigger: mismatch.
        flow.error();
        return;
      }
      try {
        const newRecord = await createPinRecord(confirmedPIN);
        await storePinHash(newRecord);
        setStep("success");
        // pin.change success trigger.
        flow.success();
      } catch {
        setConfirmError("Failed to save PIN. Please try again.");
        setNewPIN("");
        setStep("enter-new");
        // pin.change error trigger: storage failure.
        flow.error();
      }
    },
    [flow, newPIN],
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backButtonText}>{"← Back"}</Text>
      </TouchableOpacity>

      {step === "verify" && (
        <View style={styles.stepContainer}>
          <PINPad
            title="Verify PIN"
            subtitle="Enter your current 6-digit PIN"
            onComplete={handleVerify}
            failedAttempts={failedAttempts}
            lockUntil={lockUntil}
            shake={shake}
          />
          <Text style={styles.forgotNote}>
            Forgotten your PIN? You'll need to remove this wallet and set it up
            again.
          </Text>
        </View>
      )}

      {step === "enter-new" && (
        <View style={styles.stepContainer}>
          {confirmError ? (
            <Text style={styles.errorText}>{confirmError}</Text>
          ) : null}
          <PINPad
            title="New PIN"
            subtitle="Enter your new 6-digit PIN"
            onComplete={handleEnterNew}
            failedAttempts={0}
            lockUntil={null}
            shake={false}
          />
        </View>
      )}

      {step === "confirm-new" && (
        <View style={styles.stepContainer}>
          <PINPad
            title="Confirm PIN"
            subtitle="Re-enter your new PIN to confirm"
            onComplete={handleConfirm}
            failedAttempts={0}
            lockUntil={null}
            shake={false}
          />
        </View>
      )}

      {step === "success" && (
        <View style={styles.successContainer}>
          <Text style={styles.successTitle}>PIN updated</Text>
          <Text style={styles.successBody}>
            Your new PIN will be required next time you unlock the app.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.doneButton}
            accessibilityRole="button"
          >
            <Text style={styles.doneButtonText}>Back to Settings</Text>
          </TouchableOpacity>
        </View>
      )}
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
    left: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButtonText: {
    color: colors.blue600,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "500",
  },
  stepContainer: {
    flex: 1,
  },
  forgotNote: {
    color: colors.gray500,
    fontFamily: fonts.serif,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
    paddingBottom: 32,
    lineHeight: 18,
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.sans,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  successTitle: {
    color: colors.black,
    fontFamily: fonts.displayLight,
    fontSize: 28,
    marginBottom: 12,
    textAlign: "center",
  },
  successBody: {
    color: colors.gray600,
    fontFamily: fonts.serif,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  doneButton: {
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  doneButtonText: {
    color: colors.black,
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
  },
});
