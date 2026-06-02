import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ANALYTICS_COPY } from "@prl-wallet/api-client";
import { RootStackParamList } from "../../navigation/types";
import { colors, fonts, cardShadow } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Settings">;
};

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

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
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate("ChangePIN")}
            accessibilityRole="button"
            accessibilityLabel="Change PIN"
          >
            <Text style={styles.navRowLabel}>Change PIN</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </TouchableOpacity>
          {/* — Notifications nav row */}
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate("Notifications")}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Text style={styles.navRowLabel}>Notifications</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </TouchableOpacity>
          {/* — Privacy & analytics nav row */}
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate("Analytics")}
            accessibilityRole="button"
            accessibilityLabel={ANALYTICS_COPY.settingsRowLabel}
          >
            <Text style={styles.navRowLabel}>
              {ANALYTICS_COPY.settingsRowLabel}
            </Text>
            <Text style={styles.navRowChevron}>›</Text>
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
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    ...cardShadow,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  navRowLabel: {
    color: colors.black,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  navRowChevron: {
    color: colors.gray500,
    fontSize: 20,
  },
});
