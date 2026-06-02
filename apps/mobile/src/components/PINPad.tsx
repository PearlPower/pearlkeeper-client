import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, fonts, cardShadow } from "../theme";

interface PINPadProps {
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  title: string;
  subtitle?: string;
  failedAttempts?: number;
  lockUntil?: number | null;
  /** Set to true to trigger shake animation; parent resets it after detecting */
  shake?: boolean;
}

const MAX_DIGITS = 6;
const MAX_ATTEMPTS = 10;

function useCountdown(lockUntil: number | null | undefined): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!lockUntil) {
      setRemaining(0);
      return;
    }
    const update = () => setRemaining(Math.max(0, lockUntil - Date.now()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  return remaining;
}

export default function PINPad({
  onComplete,
  onCancel,
  title,
  subtitle,
  failedAttempts = 0,
  lockUntil,
  shake = false,
}: PINPadProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const remaining = useCountdown(lockUntil);
  const isLockedOut = lockUntil != null && remaining > 0;

  useEffect(() => {
    if (!shake) return;
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shake, shakeAnim]);

  useEffect(() => {
    if (digits.length === MAX_DIGITS) {
      onComplete(digits.join(""));
      setDigits([]);
    }
  }, [digits, onComplete]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (isLockedOut) return;
      setDigits((prev) => {
        if (prev.length >= MAX_DIGITS) return prev;
        return [...prev, digit];
      });
    },
    [isLockedOut],
  );

  const handleDelete = useCallback(() => {
    if (isLockedOut) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [isLockedOut]);

  const formatRemaining = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const attemptsRemaining = MAX_ATTEMPTS - failedAttempts;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {Array.from({ length: MAX_DIGITS }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < digits.length && styles.dotFilled]}
          />
        ))}
      </Animated.View>

      {failedAttempts > 0 && !isLockedOut ? (
        <Text style={styles.attemptsText}>
          {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""}{" "}
          remaining
        </Text>
      ) : null}

      {isLockedOut ? (
        <View style={styles.lockoutContainer}>
          <Text style={styles.lockoutTitle}>Too many attempts</Text>
          <Text style={styles.lockoutCountdown}>
            Try again in {formatRemaining(remaining)}
          </Text>
          {onCancel ? (
            <TouchableOpacity
              style={styles.wipeButton}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Wipe wallet and reset"
            >
              <Text style={styles.wipeButtonText}>Wipe wallet and reset</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.numpad}>
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
          ].map((row) => (
            <View key={row.join("")} style={styles.numpadRow}>
              {row.map((digit) => (
                <TouchableOpacity
                  key={digit}
                  style={styles.numpadKey}
                  onPress={() => handleDigit(digit)}
                  accessibilityRole="button"
                  accessibilityLabel={digit}
                >
                  <Text style={styles.numpadKeyText}>{digit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.numpadRow}>
            <View style={styles.numpadKey} />
            <TouchableOpacity
              style={styles.numpadKey}
              onPress={() => handleDigit("0")}
              accessibilityRole="button"
              accessibilityLabel="0"
            >
              <Text style={styles.numpadKeyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.numpadKey}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete"
            >
              <Text style={styles.numpadKeyText}>{"\u232B"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const DOT_SIZE = 16;
const KEY_SIZE = 72;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: colors.black,
    fontFamily: fonts.displayLight,
    fontSize: 24,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: colors.gray500,
    fontFamily: fonts.serif,
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 16,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: colors.black,
  },
  attemptsText: {
    color: colors.error,
    fontFamily: fonts.sans,
    fontSize: 13,
    marginBottom: 8,
    textAlign: "center",
  },
  lockoutContainer: {
    alignItems: "center",
    marginTop: 24,
    gap: 12,
  },
  lockoutTitle: {
    color: colors.error,
    fontFamily: fonts.sansSemiBold,
    fontSize: 18,
  },
  lockoutCountdown: {
    color: colors.black,
    fontFamily: fonts.displayLight,
    fontSize: 32,
    fontVariant: ["tabular-nums"],
  },
  wipeButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  wipeButtonText: {
    color: colors.error,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
  },
  numpad: {
    marginTop: 32,
    gap: 8,
  },
  numpadRow: {
    flexDirection: "row",
    gap: 8,
  },
  numpadKey: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: colors.white,
    ...cardShadow,
    alignItems: "center",
    justifyContent: "center",
  },
  numpadKeyText: {
    color: colors.black,
    fontFamily: fonts.sans,
    fontSize: 24,
  },
});
