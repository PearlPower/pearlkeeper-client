import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useSendFlow } from "./SendFlowContext";
import { colors, fonts, cardShadow } from "../../theme";

export default function SendSuccessScreen() {
  const insets = useSafeAreaInsets();
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { txid, walletId } = useSendFlow();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayTxid = txid ?? "";

  async function handleCopyTxid() {
    await Clipboard.setStringAsync(displayTxid);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }

  function handleDone() {
    rootNavigation.navigate("WalletDetail", { walletId });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successHeading}>Transaction Sent!</Text>
        <Text style={styles.successSubtext}>
          Your transaction has been broadcast to the network.
        </Text>

        <View style={styles.txidCard}>
          <Text style={styles.txidLabel}>Transaction ID</Text>
          <Text style={styles.txidText} selectable>
            {displayTxid}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.copyButton, copied && styles.copyButtonCopied]}
          onPress={handleCopyTxid}
          accessibilityRole="button"
          accessibilityLabel="Copy transaction ID"
        >
          <Text style={styles.copyButtonText}>
            {copied ? "Copied!" : "Copy TXID"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel="Done, return to home"
        >
          <Text style={styles.doneButtonText}>Done</Text>
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
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 20,
    alignItems: "center",
  },
  successIcon: {
    fontSize: 56,
    color: colors.success,
    marginTop: 32,
  },
  successHeading: {
    color: colors.success,
    fontSize: 26,
    fontFamily: fonts.sansBold,
    textAlign: "center",
  },
  successSubtext: {
    color: colors.gray500,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: fonts.serif,
  },
  txidCard: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
    ...cardShadow,
  },
  txidLabel: {
    color: colors.gray500,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.sansSemiBold,
  },
  txidText: {
    color: colors.black,
    fontSize: 12,
    fontFamily: fonts.mono,
    lineHeight: 18,
  },
  copyButton: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
  },
  copyButtonCopied: {
    borderColor: colors.success,
  },
  copyButtonText: {
    color: colors.black,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
  doneButton: {
    width: "100%",
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneButtonText: {
    color: colors.black,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
});
