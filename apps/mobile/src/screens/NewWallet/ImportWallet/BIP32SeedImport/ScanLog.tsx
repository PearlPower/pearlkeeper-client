import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../../../../theme";

type Props = {
  logs: string[];
  isOpen: boolean;
  onToggle: () => void;
};

export default function ScanLog({ logs, isOpen, onToggle }: Props) {
  if (logs.length === 0) return null;

  return (
    <>
      <TouchableOpacity
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel="Toggle scanning details"
      >
        <Text style={styles.toggle}>
          {isOpen ? "Hide scanning details ▲" : "Scanning details ▼"}
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.logBox}>
          {logs.map((line, i) => (
            <Text key={i} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toggle: {
    color: colors.blue600,
    fontSize: 13,
    fontFamily: fonts.sansSemiBold,
  },
  logBox: {
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  logLine: {
    color: colors.gray500,
    fontSize: 11,
    fontFamily: fonts.mono,
    lineHeight: 16,
  },
});
