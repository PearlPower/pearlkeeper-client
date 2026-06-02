// apps/mobile/src/screens/Settings/AnalyticsScreen.tsx
//
// Opt-in analytics settings screen (mobile).
//
// Locked copy (UI-SPEC §5 — NEVER paraphrase; single source
// `packages/api-client/src/analytics/copy.ts` consumed via `@prl-wallet/api-client`):
// Back button: "← Back"
// Hero: ANALYTICS_COPY.hero
// Body: ANALYTICS_COPY.body
// Disclosure heading: ANALYTICS_COPY.disclosureHeading
// 8 bullets: ANALYTICS_COPY.bullet1 .. bullet8
// Switch label: ANALYTICS_COPY.switchLabel
// Grant modal title: ANALYTICS_COPY.modalGrantTitle
// Grant modal body: ANALYTICS_COPY.modalGrantBody
// Grant modal accept: ANALYTICS_COPY.modalGrantAccept
// Grant modal cancel: ANALYTICS_COPY.modalGrantCancel
// Revoke confirm title: ANALYTICS_COPY.modalRevokeTitle
// Revoke confirm confirm: ANALYTICS_COPY.modalRevokeConfirm
// Revoke confirm cancel: ANALYTICS_COPY.modalRevokeCancel
//
// Visual contract: mirrors NotificationsScreen.tsx (cream bg, blue600
// accent on Switch ON + back-link, white row surfaces with cardShadow,
// OpenSans 15 / Urbanist-Light 28 / sansSemiBold 11 uppercase). Spacing:
// inherits the two non-canonical exceptions baked into the existing
// Settings contract — gap: 12 between rows (spacing.itemGap) and
// paddingVertical/Horizontal: 14 inside row cards. introduces
// no new spacing values; see UI-SPEC §2 for the inheritance ledger.

import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAdapters } from "@prl-wallet/app-adapters";
import { ANALYTICS_COPY } from "@prl-wallet/api-client";
import { RootStackParamList } from "../../navigation/types";
import { colors, fonts, cardShadow } from "../../theme";
import { useWalletListStore } from "../../store/walletListStore";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Analytics">;
};

export default function AnalyticsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { services } = useAdapters();
  const granted = useWalletListStore(
    (s) => s.analyticsConsent?.granted ?? false,
  );
  const [busy, setBusy] = useState(false);

  const handleGrantConfirm = useCallback(async () => {
    if (!services.analytics) return;
    setBusy(true);
    try {
      await services.analytics.grantConsent();
    } finally {
      setBusy(false);
    }
  }, [services]);

  const handleRevokeConfirm = useCallback(async () => {
    if (!services.analytics) return;
    setBusy(true);
    try {
      await services.analytics.revokeConsent();
    } finally {
      setBusy(false);
    }
  }, [services]);

  const handleToggle = useCallback(
    (next: boolean) => {
      if (busy) return;
      if (next) {
        // Grant flow — Cancel first (UI-SPEC §9 — primary action LAST so
        // users do not accidentally tab-Enter into Accept).
        Alert.alert(
          ANALYTICS_COPY.modalGrantTitle,
          ANALYTICS_COPY.modalGrantBody,
          [
            { text: ANALYTICS_COPY.modalGrantCancel, style: "cancel" },
            {
              text: ANALYTICS_COPY.modalGrantAccept,
              onPress: () => {
                void handleGrantConfirm();
              },
            },
          ],
          { cancelable: true },
        );
      } else {
        // Revoke flow — same Cancel-first ordering.
        Alert.alert(
          ANALYTICS_COPY.modalRevokeTitle,
          undefined,
          [
            { text: ANALYTICS_COPY.modalRevokeCancel, style: "cancel" },
            {
              text: ANALYTICS_COPY.modalRevokeConfirm,
              onPress: () => {
                void handleRevokeConfirm();
              },
            },
          ],
          { cancelable: true },
        );
      }
    },
    [busy, handleGrantConfirm, handleRevokeConfirm],
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
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
        <Text style={styles.title}>{ANALYTICS_COPY.hero}</Text>
        <Text style={styles.body}>{ANALYTICS_COPY.body}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {ANALYTICS_COPY.disclosureHeading.toUpperCase()}
          </Text>
          <View style={styles.bulletList}>
            <Text
              style={styles.bulletItem}
            >{`• ${ANALYTICS_COPY.bullet1}`}</Text>
            <Text
              style={styles.bulletItem}
            >{`• ${ANALYTICS_COPY.bullet2}`}</Text>
            <Text
              style={styles.bulletItem}
            >{`• ${ANALYTICS_COPY.bullet3}`}</Text>
            <Text
              style={styles.bulletItem}
            >{`• ${ANALYTICS_COPY.bullet4}`}</Text>
            <Text
              style={styles.bulletItem}
            >{`• ${ANALYTICS_COPY.bullet5}`}</Text>
            <Text
              style={styles.bulletItem}
            >{`• ${ANALYTICS_COPY.bullet6}`}</Text>
            <Text
              style={styles.bulletItem}
            >{`• ${ANALYTICS_COPY.bullet7}`}</Text>
            <Text
              style={styles.bulletItem}
            >{`• ${ANALYTICS_COPY.bullet8}`}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleRowLabel}>
              {ANALYTICS_COPY.switchLabel}
            </Text>
            <Switch
              value={granted}
              onValueChange={handleToggle}
              disabled={busy}
              trackColor={{ false: colors.gray300, true: colors.blue600 }}
              thumbColor={granted ? colors.white : colors.gray500}
              accessibilityRole="switch"
              accessibilityLabel={ANALYTICS_COPY.switchLabel}
              accessibilityState={{ checked: granted, disabled: busy }}
            />
          </View>
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
    gap: 24,
  },
  title: {
    color: colors.black,
    fontFamily: fonts.displayLight,
    fontSize: 28,
  },
  body: {
    color: colors.black,
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 30,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.gray500,
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    color: colors.black,
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 24,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    ...cardShadow,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  toggleRowLabel: {
    color: colors.black,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
});
