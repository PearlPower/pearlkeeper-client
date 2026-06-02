import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SendStackParamList } from "./SendNavigator";
import { useSendFlow } from "./SendFlowContext";
import { SendAddressForm } from "./components/SendAddressForm";
import { SendScannerModal } from "./components/SendScannerModal";
import { getNetworkMetadata, parseBip21Uri } from "@prl-wallet/app-flows";
import { useWalletListStore } from "../../store/walletListStore";
import { colors, fonts, cardShadow } from "../../theme";

// BIP21 paste interceptor.
// Locked verbatim copy per UI-SPEC §Copywriting (Lock #7):
const BIP21_HELPER_CAPTION =
  "Paste an address or BIP21 URI. Amounts pre-fill on the next step.";
const PASTED_AMOUNT_HINT_MS = 3000;

// Network metadata (bip21 chain id + chain-level symbol) flows from
// blockchains.json via getNetworkMetadata. Both helpers tolerate undefined
// (during the loading window before the wallet resolves) by short-circuiting
// to an empty string — keeps the existing UI contract intact.
function bip21PrefixForNetwork(networkId: string | undefined): string {
  if (!networkId) return "";
  try {
    return getNetworkMetadata(networkId).bip21Prefix;
  } catch {
    return "";
  }
}

function chainSymbolForNetwork(networkId: string | undefined): string {
  if (!networkId) return "";
  try {
    return getNetworkMetadata(networkId).assetSymbol;
  } catch {
    return "";
  }
}

export default function SendAddressScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<SendStackParamList, "SendAddress">
    >();
  const {
    addressError,
    analyticsFlow,
    closeScanner,
    handleAmountTextChange,
    handleQRScanned,
    isWatchOnly,
    openScanner,
    recipientAddress,
    scannerVisible,
    scanned,
    screenTitle,
    setRecipientAddress,
    validateAddress,
    walletId,
  } = useSendFlow();

  // tx.send flow start on first send screen mount.
  useEffect(() => {
    analyticsFlow.start();
  }, [analyticsFlow]);

  const wallet = useWalletListStore((s) =>
    s.wallets.find((w) => w.id === walletId),
  );
  const networkId = wallet?.networkId;
  const bip21Prefix = bip21PrefixForNetwork(networkId);
  const symbol = chainSymbolForNetwork(networkId);

  const [pastedAmountHint, setPastedAmountHint] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // BIP21 paste interceptor: parse → strip prefix → store amount → ephemeral
  // 3-second hint. If not a BIP21 URI, pass through unchanged.
  const onRecipientAddressChange = useCallback(
    (raw: string) => {
      const bip21 = parseBip21Uri(raw, bip21Prefix);
      if (bip21) {
        setRecipientAddress(bip21.address);
        if (bip21.amount) {
          handleAmountTextChange(bip21.amount);
          setPastedAmountHint(`Pasted amount: ${bip21.amount} ${symbol}.`);
          if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = setTimeout(() => {
            setPastedAmountHint(null);
          }, PASTED_AMOUNT_HINT_MS);
        }
        return;
      }
      setRecipientAddress(raw);
    },
    [bip21Prefix, handleAmountTextChange, setRecipientAddress, symbol],
  );

  function handleNext() {
    if (validateAddress()) {
      analyticsFlow.step("address.entered");
      navigation.navigate("SendAmount");
    }
  }

  if (isWatchOnly) {
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

        <View style={styles.watchOnlyContainer}>
          <View style={styles.watchOnlyCard}>
            <Text style={styles.watchOnlyTitle}>Watch-only Wallet</Text>
            <Text style={styles.watchOnlyMessage}>
              This is a watch-only wallet. Sending is not supported.
            </Text>
          </View>
        </View>
      </View>
    );
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

      <SendAddressForm
        addressError={addressError}
        bip21HelperCaption={BIP21_HELPER_CAPTION}
        pastedAmountHint={pastedAmountHint}
        recipientAddress={recipientAddress}
        screenTitle={screenTitle}
        topInset={insets.top}
        onNext={handleNext}
        onOpenScanner={() => {
          void openScanner();
        }}
        onRecipientAddressChange={onRecipientAddressChange}
      />

      <SendScannerModal
        visible={scannerVisible}
        topInset={insets.top}
        onClose={closeScanner}
        onQRScanned={scanned ? undefined : handleQRScanned}
      />
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
  watchOnlyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  watchOnlyCard: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    gap: 12,
    alignItems: "center",
    ...cardShadow,
  },
  watchOnlyTitle: {
    color: colors.black,
    fontSize: 18,
    fontFamily: fonts.sansSemiBold,
  },
  watchOnlyMessage: {
    color: colors.gray500,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: fonts.serif,
  },
});
