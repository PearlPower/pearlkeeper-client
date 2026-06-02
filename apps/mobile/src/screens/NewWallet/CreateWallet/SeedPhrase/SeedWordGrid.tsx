import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../../../../theme";

interface SeedWordGridProps {
  words: string[];
  revealed: boolean;
  onReveal: () => void;
}

export default function SeedWordGrid({
  words,
  revealed,
  onReveal,
}: SeedWordGridProps) {
  return (
    <View style={styles.container}>
      {/* Word grid — 2 columns */}
      <View style={styles.grid}>
        {words.map((word, index) => (
          <View key={index} style={styles.wordCell}>
            <Text style={styles.wordNumber}>{index + 1}.</Text>
            {/* When not revealed, overlay a cover on the word */}
            <View style={styles.wordTextContainer}>
              <Text
                style={styles.wordText}
                accessibilityLabel={`Word ${index + 1}`}
              >
                {word}
              </Text>
              {!revealed && <View style={styles.wordCover} />}
            </View>
          </View>
        ))}
      </View>

      {/* Full-grid "Tap to reveal" overlay when not revealed */}
      {!revealed && (
        <TouchableOpacity
          style={styles.revealOverlay}
          onPress={onReveal}
          accessibilityRole="button"
          accessibilityLabel="Tap to reveal seed phrase"
          activeOpacity={0.8}
        >
          <Text style={styles.revealIcon}>👁</Text>
          <Text style={styles.revealText}>Tap to reveal</Text>
          <Text style={styles.revealSubtext}>
            Make sure no one can see your screen
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  wordCell: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  wordNumber: {
    color: colors.gray500,
    fontSize: 12,
    fontFamily: fonts.sansSemiBold,
    minWidth: 20,
  },
  wordTextContainer: {
    position: "relative",
    flex: 1,
  },
  wordText: {
    color: colors.black,
    fontSize: 14,
    fontFamily: fonts.sansSemiBold,
  },
  wordCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.gray50,
    borderRadius: 4,
  },
  revealOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245,241,235,0.92)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 10,
    minHeight: 200,
  },
  revealIcon: {
    fontSize: 32,
  },
  revealText: {
    color: colors.black,
    fontSize: 18,
    fontFamily: fonts.sansSemiBold,
  },
  revealSubtext: {
    color: colors.gray600,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 16,
    fontFamily: fonts.serif,
  },
});
