import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../../../../theme";

type Props = {
  wordCount: 12 | 24;
  onSelect: (count: 12 | 24) => void;
};

function WordCountButton({
  count,
  isSelected,
  onPress,
}: {
  count: 12 | 24;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, isSelected && styles.segmentButtonActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} words`}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        style={[
          styles.segmentButtonText,
          isSelected && styles.segmentButtonTextActive,
        ]}
      >
        {count} words
      </Text>
    </TouchableOpacity>
  );
}

export function MnemonicWordCountToggle({ wordCount, onSelect }: Props) {
  return (
    <View style={styles.segmentedControl}>
      <WordCountButton
        count={12}
        isSelected={wordCount === 12}
        onPress={() => onSelect(12)}
      />
      <WordCountButton
        count={24}
        isSelected={wordCount === 24}
        onPress={() => onSelect(24)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedControl: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: colors.gray50,
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: colors.black,
  },
  segmentButtonText: {
    color: colors.gray500,
    fontSize: 14,
    fontFamily: fonts.sansSemiBold,
  },
  segmentButtonTextActive: {
    color: colors.white,
  },
});
