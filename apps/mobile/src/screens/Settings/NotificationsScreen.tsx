// apps/mobile/src/screens/Settings/NotificationsScreen.tsx
//
// Push Notifications settings (master + 3 sub-toggles).
//
// Locked copy (UI-SPEC §Copywriting Contract — NEVER paraphrase):
// Back button: "← Back"
// Screen H1: "Notifications"
// Section label: "PUSH NOTIFICATIONS"
// Master row: "Push notifications"
// Sub-row 1: "Incoming transactions"
// Sub-row 2: "Security alerts"
// Sub-row 3: "Update notifications"
// Permission-denied helper: "Pearl Keeper doesn't have permission to send notifications.
// Enable in iOS Settings / Android System Settings."
// Permission-denied button: "Open Settings"
//
// Locked local-notification copy (rendered by pushTaskHandler.ts after
// data payload arrives — NEVER paraphrase):
// incoming-tx title: "Incoming transaction"
// incoming-tx body: "New activity in '{walletName}'"
// security-event title: "Security alert"
// security-event body: "Your wallet was accessed from a new location."
// version-update title: "Update available"
// version-update body: "A new version of Pearl Keeper is available."
//
// Visual contract: mirrors SettingsScreen.tsx (cream bg, blue600 accent on
// switch ON + Open-Settings button + back-link, white row surfaces with
// cardShadow, OpenSans 15 / Urbanist-Light 28 / sansSemiBold 11 uppercase).
// Spacing: inherits the two non-canonical exceptions baked into the
// existing mobile Settings contract — gap: 12 between rows (spacing.itemGap)
// and paddingVertical/Horizontal: 14 inside row cards (SettingsScreen.tsx
// styles.navRow). introduces no new spacing values; see UI-SPEC
// §Spacing Scale for the inheritance ledger.

import React, { useCallback, useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAdapters } from "@prl-wallet/app-adapters";
import type {
  PushPrefs,
  PushRegisterRequest,
  PushRegisterMeResponse,
  PushSubscription,
} from "@prl-wallet/api-schemas";
import { RootStackParamList } from "../../navigation/types";
import { colors, fonts, cardShadow } from "../../theme";
import { useWalletListStore } from "../../store/walletListStore";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Notifications">;
};

// 6 master-switch states per UI-SPEC §Master switch state machine.
type MasterState =
  | "disabled-no-permission-asked"
  | "enabling"
  | "enabled"
  | "disabling"
  | "permission-denied"
  | "permission-revoked-in-os-settings";

const PUSH_PREFS_QUERY_KEY = ["push-prefs"] as const;

const ALL_PREFS_ON: PushPrefs = {
  incomingTx: true,
  securityEvent: true,
  versionUpdate: true,
};

/**
 * Build subscriptions for the registerPush body from the local
 * walletListStore. Each wallet contributes ONE subscription if it has a
 * `nextReceiveAddress` (W-7 — locked field name). Wallets without a derived
 * receive address are skipped (the user must visit Receive once before
 * notifications can target that wallet — server-side schema rejects
 * empty subscriptions arrays per / PushRegisterRequestSchema.min(1)).
 */
function buildSubscriptions(): PushSubscription[] {
  const wallets = useWalletListStore.getState().wallets;
  return wallets.flatMap((w) => {
    if (!w.nextReceiveAddress) return [];
    return [
      {
        networkId: w.networkId as PushSubscription["networkId"],
        address: w.nextReceiveAddress,
        walletId: w.id,
      },
    ];
  });
}

function deriveInitialMasterState(
  data: PushRegisterMeResponse | undefined,
): MasterState {
  if (data?.registered) return "enabled";
  return "disabled-no-permission-asked";
}

export default function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { services } = useAdapters();
  const pushPort = services.push;

  // server-authoritative read on mount; mutations invalidate to refresh.
  const prefsQuery = useQuery({
    queryKey: PUSH_PREFS_QUERY_KEY,
    queryFn: async (): Promise<PushRegisterMeResponse> => {
      if (!pushPort) return { registered: false, prefs: null };
      return pushPort.getPushPrefs();
    },
  });

  const [masterState, setMasterState] = useState<MasterState>(() =>
    deriveInitialMasterState(prefsQuery.data),
  );

  // Sync local state once prefsQuery settles (initial mount).
  useEffect(() => {
    if (!prefsQuery.data) return;
    setMasterState((prev) => {
      // Don't override an in-flight transition state.
      if (prev === "enabling" || prev === "disabling") return prev;
      // Don't override permission-denied/revoked — those are OS-side.
      if (
        prev === "permission-denied" ||
        prev === "permission-revoked-in-os-settings"
      ) {
        return prev;
      }
      return deriveInitialMasterState(prefsQuery.data);
    });
  }, [prefsQuery.data]);

  const registerMutation = useMutation({
    mutationFn: async (body: PushRegisterRequest) => {
      if (!pushPort) throw new Error("push port unavailable");
      return pushPort.registerPush(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PUSH_PREFS_QUERY_KEY });
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: async () => {
      if (!pushPort) throw new Error("push port unavailable");
      return pushPort.unregisterPush();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PUSH_PREFS_QUERY_KEY });
    },
  });

  // Master toggle state machine handler (UI-SPEC §Master switch state machine).
  const handleMasterToggle = useCallback(
    async (next: boolean) => {
      if (next) {
        setMasterState("enabling");
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          setMasterState("permission-denied");
          return;
        }
        try {
          const tokenInfo = await Notifications.getDevicePushTokenAsync();
          const subs = buildSubscriptions();
          if (subs.length === 0) {
            // No receive addresses derived yet — server-side schema rejects
            // empty subscriptions arrays ( sybil cap min(1)). Revert
            // silently; user must visit Receive screen first. UI-SPEC §error
            // state contract — silent revert, no toast.
            setMasterState("disabled-no-permission-asked");
            return;
          }
          await registerMutation.mutateAsync({
            token: tokenInfo.data,
            platform: tokenInfo.type as "ios" | "android",
            subscriptions: subs,
            prefs: ALL_PREFS_ON,
          });
          setMasterState("enabled");
        } catch {
          // Silent revert per UI-SPEC §error state contract.
          setMasterState("disabled-no-permission-asked");
        }
      } else {
        setMasterState("disabling");
        try {
          await unregisterMutation.mutateAsync();
          setMasterState("disabled-no-permission-asked");
        } catch {
          // Silent revert. Re-fetch on next foreground will re-sync truth.
          setMasterState("enabled");
        }
      }
    },
    [registerMutation, unregisterMutation],
  );

  // Sub-toggle handler — UPSERT registerPush with full updated prefs ().
  const handleSubToggle = useCallback(
    async (key: keyof PushPrefs, next: boolean) => {
      const currentPrefs = prefsQuery.data?.prefs ?? ALL_PREFS_ON;
      const newPrefs: PushPrefs = { ...currentPrefs, [key]: next };
      try {
        const tokenInfo = await Notifications.getDevicePushTokenAsync();
        const subs = buildSubscriptions();
        if (subs.length === 0) return; // defense-in-depth
        await registerMutation.mutateAsync({
          token: tokenInfo.data,
          platform: tokenInfo.type as "ios" | "android",
          subscriptions: subs,
          prefs: newPrefs,
        });
      } catch {
        // Silent revert per UI-SPEC §error state contract.
      }
    },
    [prefsQuery.data, registerMutation],
  );

  // foreground sync — re-read OS permission status when app returns
  // to foreground; if user revoked permission via OS Settings while we
  // were enabled, snap master to permission-revoked-in-os-settings.
  // Backend row preserved per — do NOT call unregisterPush here.
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        if (nextState !== "active") return;
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted" && masterState === "enabled") {
          setMasterState("permission-revoked-in-os-settings");
        }
      },
    );
    return () => sub.remove();
  }, [masterState]);

  const masterIsOn = masterState === "enabled";
  const masterDisabled =
    masterState === "enabling" || masterState === "disabling";
  const subTogglesActive = masterIsOn;
  const helperVisible =
    masterState === "permission-denied" ||
    masterState === "permission-revoked-in-os-settings";

  const currentPrefs = prefsQuery.data?.prefs ?? ALL_PREFS_ON;

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

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
        <Text style={styles.title}>Notifications</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PUSH NOTIFICATIONS</Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleRowLabel}>Push notifications</Text>
            <Switch
              value={masterIsOn}
              onValueChange={handleMasterToggle}
              disabled={masterDisabled}
              trackColor={{ false: colors.gray300, true: colors.blue600 }}
              thumbColor={masterIsOn ? colors.white : colors.gray500}
              accessibilityLabel="Push notifications"
              accessibilityRole="switch"
            />
          </View>

          {helperVisible ? (
            <View style={styles.helperBlock}>
              <Text style={styles.helperText}>
                Pearl Keeper doesn't have permission to send notifications.
                Enable in iOS Settings / Android System Settings.
              </Text>
              <TouchableOpacity
                style={styles.openSettingsButton}
                onPress={handleOpenSettings}
                accessibilityRole="button"
                accessibilityLabel="Open Settings"
              >
                <Text style={styles.openSettingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View
            style={[
              styles.subToggleRow,
              !subTogglesActive && styles.subToggleRowDisabled,
            ]}
          >
            <Text
              style={[
                styles.toggleRowLabel,
                !subTogglesActive && styles.toggleRowLabelDisabled,
              ]}
            >
              Incoming transactions
            </Text>
            <Switch
              value={subTogglesActive ? currentPrefs.incomingTx : false}
              onValueChange={(v) => handleSubToggle("incomingTx", v)}
              disabled={!subTogglesActive}
              trackColor={{ false: colors.gray300, true: colors.blue600 }}
              thumbColor={
                subTogglesActive && currentPrefs.incomingTx
                  ? colors.white
                  : colors.gray500
              }
              accessibilityLabel="Incoming transactions"
              accessibilityRole="switch"
            />
          </View>

          <View
            style={[
              styles.subToggleRow,
              !subTogglesActive && styles.subToggleRowDisabled,
            ]}
          >
            <Text
              style={[
                styles.toggleRowLabel,
                !subTogglesActive && styles.toggleRowLabelDisabled,
              ]}
            >
              Security alerts
            </Text>
            <Switch
              value={subTogglesActive ? currentPrefs.securityEvent : false}
              onValueChange={(v) => handleSubToggle("securityEvent", v)}
              disabled={!subTogglesActive}
              trackColor={{ false: colors.gray300, true: colors.blue600 }}
              thumbColor={
                subTogglesActive && currentPrefs.securityEvent
                  ? colors.white
                  : colors.gray500
              }
              accessibilityLabel="Security alerts"
              accessibilityRole="switch"
            />
          </View>

          <View
            style={[
              styles.subToggleRow,
              !subTogglesActive && styles.subToggleRowDisabled,
            ]}
          >
            <Text
              style={[
                styles.toggleRowLabel,
                !subTogglesActive && styles.toggleRowLabelDisabled,
              ]}
            >
              Update notifications
            </Text>
            <Switch
              value={subTogglesActive ? currentPrefs.versionUpdate : false}
              onValueChange={(v) => handleSubToggle("versionUpdate", v)}
              disabled={!subTogglesActive}
              trackColor={{ false: colors.gray300, true: colors.blue600 }}
              thumbColor={
                subTogglesActive && currentPrefs.versionUpdate
                  ? colors.white
                  : colors.gray500
              }
              accessibilityLabel="Update notifications"
              accessibilityRole="switch"
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
  subToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    ...cardShadow,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginLeft: 8,
  },
  subToggleRowDisabled: {
    opacity: 0.4,
  },
  toggleRowLabel: {
    color: colors.black,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  toggleRowLabelDisabled: {
    color: colors.gray500,
  },
  helperBlock: {
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  helperText: {
    color: colors.gray600,
    fontFamily: fonts.serif,
    fontSize: 13,
    lineHeight: 18,
  },
  openSettingsButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.blue600,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  openSettingsButtonText: {
    color: colors.white,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
  },
});
