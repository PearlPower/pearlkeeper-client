import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts } from "../../../../theme";

type Props = {
  value: string;
  onChange: (text: string) => void;
  error: string | null;
  disabled?: boolean;
  extendedKeyPrefix: string;
};

export default function SeedInput({
  value,
  onChange,
  error,
  disabled,
  extendedKeyPrefix,
}: Props) {
  return (
    <>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={`64 or 128 hex chars, or ${extendedKeyPrefix}...`}
          placeholderTextColor={colors.gray500}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          numberOfLines={4}
          returnKeyType="done"
          editable={!disabled}
        />
      </View>

      <View style={styles.hintBox}>
        <Text style={styles.hintTitle}>Accepted formats:</Text>
        <Text style={styles.hintText}>
          1. 64–128 hex characters (32–64 byte raw BIP32 seed)
        </Text>
        <Text style={styles.hintText}>
          2. {extendedKeyPrefix}... extended private key
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: colors.black,
    fontSize: 14,
    fontFamily: fonts.mono,
    minHeight: 100,
    textAlignVertical: "top",
  },
  hintBox: {
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    padding: 14,
    gap: 4,
  },
  hintTitle: {
    color: colors.blue600,
    fontSize: 13,
    fontFamily: fonts.sansSemiBold,
    marginBottom: 4,
  },
  hintText: {
    color: colors.gray600,
    fontSize: 13,
    fontFamily: fonts.serif,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    fontFamily: fonts.serif,
  },
});
