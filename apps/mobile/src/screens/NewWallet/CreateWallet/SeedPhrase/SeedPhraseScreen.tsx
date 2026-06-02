import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import type { NewWalletStackParamList } from "../../services/newWalletFlowTypes";
import SeedWordGrid from "./SeedWordGrid";
import { colors, fonts } from "../../../../theme";

type Props = {
  navigation: NativeStackNavigationProp<NewWalletStackParamList, "SeedPhrase">;
  route: RouteProp<NewWalletStackParamList, "SeedPhrase">;
};

export default function SeedPhraseScreen({ navigation, route }: Props) {
  const { mnemonic } = route.params;
  const words = mnemonic.split(" ");
  const insets = useSafeAreaInsets();
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* Back button — same pattern as SeedVerifyScreen */}
      <TouchableOpacity
        style={[styles.backButton, { paddingTop: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back to wallet setup"
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Seed Phrase</Text>
          <Text style={styles.subtitle}>
            Write down all {words.length} words in order and store them safely.
            Never share them with anyone.
          </Text>
        </View>

        <View style={styles.gridContainer}>
          <SeedWordGrid
            words={words}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
          />
        </View>

        {revealed && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Anyone with your seed phrase can access your funds. Store it
              offline and never share it.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.continueButton,
            !revealed && styles.continueButtonDisabled,
          ]}
          onPress={() => {
            if (revealed) {
              navigation.navigate("SeedVerify", { mnemonic });
            }
          }}
          disabled={!revealed}
          accessibilityRole="button"
          accessibilityLabel="I've written it down — Continue"
          accessibilityState={{ disabled: !revealed }}
        >
          <Text
            style={[
              styles.continueButtonText,
              !revealed && styles.continueButtonTextDisabled,
            ]}
          >
            I&apos;ve written it down — Continue
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButtonText: {
    color: colors.blue600,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    color: colors.black,
    fontSize: 26,
    fontFamily: fonts.sansBold,
  },
  subtitle: {
    color: colors.gray600,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.serif,
  },
  gridContainer: {
    minHeight: 280,
  },
  warningBox: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.serif,
  },
  continueButton: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  continueButtonDisabled: {
    borderColor: colors.gray300,
  },
  continueButtonText: {
    color: colors.black,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
  continueButtonTextDisabled: {
    color: colors.gray500,
  },
});
