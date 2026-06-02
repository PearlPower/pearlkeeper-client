import React, { useEffect, useState, forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { wordlist } from "@scure/bip39/wordlists/english";
import { colors, fonts } from "../../../../theme";

type WordInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onWordSelected: (word: string) => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  index: number;
};

const WordInput = forwardRef<TextInput, WordInputProps>(
  (
    {
      value,
      onChangeText,
      onWordSelected,
      onSubmitEditing,
      placeholder,
      index,
    },
    ref,
  ) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);

    useEffect(() => {
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }
      const lower = value.toLowerCase();
      const matches = (wordlist as string[])
        .filter((w) => w.startsWith(lower))
        .slice(0, 4);
      setSuggestions(matches);
    }, [value]);

    return (
      <View style={styles.container}>
        <View style={styles.inputRow}>
          <Text style={styles.label}>{index}.</Text>
          <TextInput
            ref={ref}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            placeholder={placeholder ?? `Word ${index}`}
            placeholderTextColor={colors.gray500}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="next"
            blurOnSubmit={false}
          />
        </View>
        {suggestions.length > 0 ? (
          <View style={styles.suggestionsRow}>
            {suggestions.map((word) => (
              <TouchableOpacity
                key={word}
                style={styles.suggestionChip}
                onPress={() => onWordSelected(word)}
                accessibilityRole="button"
                accessibilityLabel={`Select word ${word}`}
              >
                <Text style={styles.suggestionText}>{word}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    );
  },
);

WordInput.displayName = "WordInput";

export default WordInput;

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: colors.gray500,
    fontSize: 13,
    fontFamily: fonts.sans,
    width: 28,
    textAlign: "right",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: colors.black,
    fontSize: 15,
    fontFamily: fonts.serif,
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
    marginLeft: 36,
  },
  suggestionChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  suggestionText: {
    color: colors.black,
    fontSize: 13,
    fontFamily: fonts.sansSemiBold,
  },
});
