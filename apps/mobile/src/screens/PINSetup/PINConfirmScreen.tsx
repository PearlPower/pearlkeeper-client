import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import PINPad from "../../components/PINPad";
import { createPinRecord, storePinHash } from "../../services/secureStorage";
import { usePINStore } from "../../store/pinStore";
import { RootStackParamList } from "../../navigation/types";
import { colors, fonts } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "PINConfirm">;
  route: RouteProp<RootStackParamList, "PINConfirm">;
};

export default function PINConfirmScreen({ navigation, route }: Props) {
  const { pin } = route.params;
  const [shakeKey, setShakeKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async (confirmedPin: string) => {
    if (confirmedPin !== pin) {
      setError("PINs do not match — try again");
      setShakeKey((k) => k + 1);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const record = await createPinRecord(confirmedPin);
      await storePinHash(record);
      usePINStore.getState().setHasPIN(true);
      navigation.navigate("NewWalletFlow");
    } catch (_err) {
      setError(
        "Could not save PIN — please ensure your device has a passcode set",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <PINPad
        key={shakeKey}
        title="Confirm your PIN"
        subtitle="Re-enter your 6-digit PIN to finish securing your wallet"
        onComplete={handleConfirm}
      />
      {isSaving ? (
        <View style={styles.savingOverlay}>
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  errorBanner: {
    position: "absolute",
    top: 60,
    left: 24,
    right: 24,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    zIndex: 10,
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  savingOverlay: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
  },
  savingText: {
    color: colors.gray500,
    fontFamily: fonts.serif,
    fontSize: 14,
  },
});
