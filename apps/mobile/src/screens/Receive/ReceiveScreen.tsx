import React from "react";
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useReceiveFlow } from "@prl-wallet/app-flows";
import { RootStackParamList } from "../../navigation/types";
import { colors, fonts, cardShadow } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Receive">;
  route: RouteProp<RootStackParamList, "Receive">;
};

export default function ReceiveScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { walletId } = route.params;
  const {
    copyAddress,
    copyLabel,
    generateAnotherAddress,
    goBack,
    isGeneratingAnother,
    receiveAddress,
    shareAddress,
  } = useReceiveFlow({
    walletId,
    navigation: { goBack: () => navigation.goBack() },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={goBack}
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
      >
        <Text style={styles.title}>Receive</Text>

        <View style={styles.qrContainer}>
          {receiveAddress ? (
            <QRCode
              value={receiveAddress}
              size={240}
              backgroundColor={colors.white}
              color={colors.black}
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>—</Text>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.addressLabel}>Your Address</Text>
          <Text style={styles.addressText} selectable>
            {receiveAddress ?? "—"}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={copyAddress}
            accessibilityRole="button"
            accessibilityLabel="Copy address"
          >
            <Text style={styles.actionButtonText}>{copyLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={shareAddress}
            accessibilityRole="button"
            accessibilityLabel="Share address"
          >
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.advancedSection}>
          <Text style={styles.advancedTitle}>Need a fresh address?</Text>
          <Text style={styles.advancedBody}>
            The current address is valid and has not been used before. Generate
            a new receive address only if you want better privacy by separating
            future deposits.
          </Text>
          <TouchableOpacity
            style={styles.advancedLink}
            onPress={generateAnotherAddress}
            disabled={isGeneratingAnother}
            accessibilityRole="button"
            accessibilityLabel="Generate a new receive address"
          >
            {isGeneratingAnother ? (
              <ActivityIndicator size="small" color={colors.blue600} />
            ) : (
              <Text style={styles.advancedLinkText}>
                Generate a new receive address
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: "center",
    gap: 24,
  },
  title: {
    color: colors.black,
    fontFamily: fonts.displayLight,
    fontSize: 28,
    alignSelf: "center",
  },
  qrContainer: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    ...cardShadow,
  },
  qrPlaceholder: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    color: colors.gray300,
    fontSize: 32,
  },
  infoCard: {
    width: "100%",
    backgroundColor: colors.white,
    ...cardShadow,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  addressLabel: {
    color: colors.gray500,
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addressText: {
    color: colors.black,
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionButtonText: {
    color: colors.gray700,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
  },
  advancedSection: {
    width: "100%",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray300,
    alignItems: "flex-start",
    gap: 8,
  },
  advancedTitle: {
    color: colors.gray600,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
  },
  advancedBody: {
    color: colors.gray500,
    fontFamily: fonts.serif,
    fontSize: 12,
    lineHeight: 18,
  },
  advancedLink: {
    minHeight: 24,
    justifyContent: "center",
  },
  advancedLinkText: {
    color: colors.blue600,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
  },
});
