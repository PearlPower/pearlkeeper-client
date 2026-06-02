// apps/mobile/src/components/UpdateBanner.tsx
//
// Unified update panel — mobile half. Composes `useUpdateBanner` over the
// signed version-manifest port + lazy changelog fetch, then renders:
//
// state === "hidden" → null
// state === "nudge" → top-of-screen banner with "Update" / "✕" actions
// state === "forced" → full-bleed modal with the markdown changelog +
// platform-appropriate install buttons:
// iOS: single "Open App Store" button
// Android: "Install update" (direct APK) and
// "Open Play Store" — each shown only
// when its URL is present in the
// release row.
//
// Direct APK side-load goes through expo-file-system + expo-intent-launcher
// (see ../lib/installApk.ts). Falls back to the Play Store button on intent
// failure; the user retains a path forward.

import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import * as Application from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Markdown from "react-native-markdown-display";
import { useUpdateBanner } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { installApk } from "../lib/installApk";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";

const DISMISSED_VERSION_KEY = "update-banner:dismissedVersion";

const installedVersion = Application.nativeApplicationVersion ?? "0.0.0";

async function getDismissedVersion(): Promise<string | null> {
  return AsyncStorage.getItem(DISMISSED_VERSION_KEY);
}

async function setDismissedVersion(v: string): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_VERSION_KEY, v);
}

// No-op port for the rare case where a test bundle omits signedConfig.
// useUpdateBanner sees the result as "loading" forever (no data) and
// returns the hidden empty result — keeps the hook order stable across
// renders regardless of whether the port is wired.
const noopSignedConfigPort = {
  getChainConfig: (async () => null) as never,
  getVersionManifest: (async () => null) as never,
};

export function UpdateBanner(): React.ReactElement | null {
  const { services } = useAdapters();
  const signedConfigPort = services.signedConfig;
  const releasesPort = services.releases;

  // Memoize so the hook's internal effect (deps include args.installedVersion
  // but not args.getChangelog) sees a stable identity across renders. Without
  // this, every render re-creates the function — fine today because the hook
  // ignores it in deps, but it's a footgun if the deps array ever widens.
  const getChangelog = useMemo(
    () =>
      releasesPort
        ? async (currentVersion: string): Promise<string> => {
            const { releases } =
              await releasesPort.getReleasesSince(currentVersion);
            return releases.map((r) => r.changelog).join("\n\n---\n\n");
          }
        : undefined,
    [releasesPort],
  );

  // Hooks must run unconditionally on every render (React Rules of Hooks).
  // The guard on `signedConfigPort` lives AFTER the hook call; the noop
  // port keeps the hook well-formed when the adapters bundle is partial.
  const banner = useUpdateBanner(signedConfigPort ?? noopSignedConfigPort, {
    installedVersion,
    getDismissedVersion,
    setDismissedVersion,
    getChangelog,
  });

  if (!signedConfigPort) return null;
  if (banner.state === "hidden") return null;

  const onOpenIosStore = () => {
    if (!banner.iosStoreUrl) return;
    Linking.openURL(banner.iosStoreUrl).catch(() => {
      /* Linking failures are platform-level; intentional no-op. */
    });
  };

  const onOpenPlayStore = () => {
    if (!banner.androidPlayUrl) return;
    Linking.openURL(banner.androidPlayUrl).catch(() => {});
  };

  const onInstallApk = async () => {
    if (!banner.androidApkUrl) return;
    const result = await installApk(banner.androidApkUrl);
    if (result.ok) return;
    // Direct install failed — most often the user hasn't enabled "Install
    // unknown apps" for our app, or the download failed. Fall back to Play
    // Store if we have its URL; otherwise show what went wrong so the user
    // has a path forward.
    if (banner.androidPlayUrl) {
      Alert.alert(
        "Couldn't install update",
        "Direct install isn't available. Open the Play Store to update instead?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Play Store",
            onPress: () => {
              if (!banner.androidPlayUrl) return;
              Linking.openURL(banner.androidPlayUrl).catch(() => {});
            },
          },
        ],
      );
      return;
    }
    const message =
      result.reason === "download-failed"
        ? "Couldn't download the update package. Check your connection and try again."
        : result.reason === "no-cache-dir"
          ? "Couldn't reach the device's cache storage. Try restarting the app."
          : "Your device blocked the install. Enable 'Install unknown apps' for Pearl Keeper in system settings, then try again.";
    Alert.alert("Couldn't install update", message);
  };

  if (banner.state === "nudge") {
    return (
      <View
        style={styles.nudgeContainer}
        accessibilityRole="alert"
        accessibilityLabel="Update available. Tap Update to install or close to dismiss."
      >
        <Text style={styles.nudgeLabel}>
          Update available — v{banner.latestVersion}
        </Text>
        <View style={styles.nudgeActions}>
          <TouchableOpacity
            onPress={Platform.OS === "ios" ? onOpenIosStore : onOpenPlayStore}
            accessibilityLabel="Open store to update"
          >
            <Text style={styles.nudgeCta}>Update</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={banner.dismiss}
            accessibilityLabel="Dismiss update notification"
          >
            <Text style={styles.dismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // state === "forced"
  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={() => {
        // No-op — Android back button must NOT dismiss a forced update.
      }}
    >
      <View style={styles.modalRoot}>
        <Text accessibilityRole="header" style={styles.modalTitle}>
          Update Available
        </Text>
        <Text style={styles.modalSubtitle}>v{banner.latestVersion}</Text>
        <ScrollView style={styles.changelogScroll}>
          {banner.changelog ? (
            <Markdown style={markdownStyles}>{banner.changelog}</Markdown>
          ) : (
            <Text style={styles.modalBody}>
              A new version is available. Tap below to install.
            </Text>
          )}
        </ScrollView>
        <View style={styles.actions}>
          {Platform.OS === "ios" && banner.iosStoreUrl ? (
            <TouchableOpacity
              onPress={onOpenIosStore}
              style={styles.cta}
              accessibilityLabel="Open App Store"
            >
              <Text style={styles.ctaLabel}>Open App Store</Text>
            </TouchableOpacity>
          ) : null}
          {Platform.OS === "android" && banner.androidApkUrl ? (
            <TouchableOpacity
              onPress={onInstallApk}
              style={styles.cta}
              accessibilityLabel="Install update directly"
            >
              <Text style={styles.ctaLabel}>Install update</Text>
            </TouchableOpacity>
          ) : null}
          {Platform.OS === "android" && banner.androidPlayUrl ? (
            <TouchableOpacity
              onPress={onOpenPlayStore}
              style={styles.ctaSecondary}
              accessibilityLabel="Open Play Store"
            >
              <Text style={styles.ctaSecondaryLabel}>Open Play Store</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  nudgeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.warningBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.warningBorder,
  },
  nudgeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  nudgeLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.gray800,
  },
  nudgeCta: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.blue600,
  },
  dismiss: {
    fontSize: 16,
    color: colors.gray500,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: 64,
    paddingBottom: spacing.screenBottom,
    gap: spacing.sectionGap,
  },
  modalTitle: {
    fontFamily: fonts.displayLight,
    fontSize: 28,
    color: colors.gray800,
  },
  modalSubtitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.gray700,
    marginTop: -spacing.sectionGap + 4,
  },
  changelogScroll: {
    flex: 1,
  },
  modalBody: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.gray700,
  },
  actions: {
    gap: 12,
  },
  cta: {
    backgroundColor: colors.blue600,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: "center",
  },
  ctaLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.white,
  },
  ctaSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.blue600,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: "center",
  },
  ctaSecondaryLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.blue600,
  },
});

const markdownStyles = {
  body: { color: colors.gray700, fontFamily: fonts.serif, fontSize: 16 },
  heading1: { fontFamily: fonts.sansSemiBold, fontSize: 20, marginTop: 8 },
  heading2: { fontFamily: fonts.sansSemiBold, fontSize: 18, marginTop: 8 },
  heading3: { fontFamily: fonts.sansSemiBold, fontSize: 16, marginTop: 8 },
  bullet_list: { marginVertical: 4 },
};
