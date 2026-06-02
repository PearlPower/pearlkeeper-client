import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, fonts } from "../../../../theme";

type Props = {
  onPress: () => void;
  isImporting: boolean;
};

export default function ImportButton({ onPress, isImporting }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, isImporting && styles.buttonBusy]}
      onPress={onPress}
      disabled={isImporting}
      accessibilityRole="button"
      accessibilityLabel="Import wallet"
    >
      {isImporting ? (
        <View style={styles.content}>
          <ActivityIndicator
            color={colors.gray500}
            size="small"
            style={styles.spinner}
          />
          <Text style={styles.labelBusy}>Scanning addresses…</Text>
        </View>
      ) : (
        <Text style={styles.label}>Import</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonBusy: {
    borderColor: colors.gray300,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  spinner: {
    marginRight: 4,
  },
  label: {
    color: colors.black,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
  labelBusy: {
    color: colors.gray500,
    fontSize: 16,
    fontFamily: fonts.sansSemiBold,
  },
});
