import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { deleteAllSecrets } from "@prl-wallet/services";
import PINPad from "../components/PINPad";
import * as secureStorage from "../services/secureStorage";
import { getPinHash, verifyPin } from "../services/secureStorage";
import { useLockStore } from "../store/lockStore";
import { useWalletListStore } from "../store/walletListStore";
import { colors } from "../theme";

export default function PINUnlockScreen() {
  const { failedAttempts, lockUntil, unlock, recordFailedAttempt } =
    useLockStore();
  const removeWallet = useWalletListStore((s) => s.removeWallet);
  const wallets = useWalletListStore((s) => s.wallets);
  const setActiveWalletId = useWalletListStore((s) => s.setActiveWalletId);
  const [shake, setShake] = useState(false);

  const biometricAttemptedRef = useRef(false);

  useEffect(() => {
    if (biometricAttemptedRef.current) return;
    biometricAttemptedRef.current = true;

    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) return;

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock your wallet",
          fallbackLabel: "Use PIN",
        });
        if (result.success) {
          unlock();
        }
      } catch {
        // Biometric not available — fall through to PIN
      }
    })();
  }, [unlock]);

  useEffect(() => {
    if (shake) {
      const timer = setTimeout(() => setShake(false), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [shake]);

  const handlePINComplete = useCallback(
    async (enteredPIN: string) => {
      try {
        const storedHash = await getPinHash();
        if (!storedHash) {
          unlock();
          return;
        }
        if (await verifyPin(enteredPIN, storedHash)) {
          unlock();
        } else {
          recordFailedAttempt();
          setShake(true);
        }
      } catch {
        recordFailedAttempt();
        setShake(true);
      }
    },
    [unlock, recordFailedAttempt],
  );

  const handleWipeAndReset = useCallback(async () => {
    try {
      // / : shared port-based factory-reset helper.
      // Walks the hydrated wallet list (canonical source of truth) before
      // deleting the global PIN hash — replaces mobile's legacy hardcoded
      // v1.0 key list (which would orphan post-v1.1 per-wallet keys).
      await deleteAllSecrets({ secrets: secureStorage, wallets });
    } catch {
      // Best effort
    }
    for (const w of wallets) {
      removeWallet(w.id);
    }
    setActiveWalletId(null);
  }, [wallets, removeWallet, setActiveWalletId]);

  return (
    <View style={styles.container}>
      <PINPad
        title="Enter PIN"
        subtitle="Enter your 6-digit PIN to unlock"
        onComplete={handlePINComplete}
        onCancel={handleWipeAndReset}
        failedAttempts={failedAttempts}
        lockUntil={lockUntil}
        shake={shake}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
});
