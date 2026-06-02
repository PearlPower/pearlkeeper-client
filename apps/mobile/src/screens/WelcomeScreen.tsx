import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";
import { usePINStore } from "../store/pinStore";
import { colors, fonts } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Welcome">;
};

export default function WelcomeScreen({ navigation }: Props) {
  const hasPIN = usePINStore((s) => s.hasPIN);

  const handleGetStarted = () => {
    if (!hasPIN) {
      navigation.navigate("PINCreate");
    } else {
      navigation.navigate("NewWalletFlow");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroSection}>
        <Text style={styles.logo}>Pearl Keeper</Text>
        <Text style={styles.tagline}>Your keys. Your coins.</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleGetStarted}
        accessibilityRole="button"
        accessibilityLabel="Get Started"
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    color: colors.black,
    fontFamily: fonts.displayExtraLight,
    fontSize: 40,
    letterSpacing: 1,
    marginBottom: 12,
  },
  tagline: {
    color: colors.gray700,
    fontFamily: fonts.serif,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  button: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: {
    color: colors.black,
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
  },
});
