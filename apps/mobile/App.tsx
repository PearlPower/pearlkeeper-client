import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import {
  performFirstBootWipeIfNeeded,
  useBootstrapSecurity,
} from "@prl-wallet/app-flows";
import AppNavigator from "./src/navigation/AppNavigator";
import { useLockStore } from "./src/store/lockStore";
import { QueryProvider } from "./src/providers/QueryProvider";
import { StoresProvider } from "./src/providers/StoresProvider";
import { MobileAdaptersProvider } from "./src/providers/AdaptersProvider";
import { navigationRef } from "./src/navigation/navigationRef";
import { handlePushDataPayload } from "./src/lib/pushTaskHandler";
import { PushListenersSetup } from "./src/lib/pushListenersSetup";
import { UpdateBanner } from "./src/components/UpdateBanner";

// / — iOS headless background path. The
// TaskManager handler renders the locked copy when a data-only push
// arrives while the app is backgrounded on iOS (addNotificationReceivedListener
// does NOT fire for apns-push-type: background — TaskManager is the only
// hook). Defined at module scope so the JS bundle has it registered before
// any React tree mounts.
const PUSH_BACKGROUND_TASK = "PRL_PUSH_BACKGROUND";

// Foreground display rules (Android — addNotificationReceivedListener fires
// here; iOS data-only payloads route through TaskManager above).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // SDK 54+ — replaces deprecated shouldShowAlert
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

TaskManager.defineTask(PUSH_BACKGROUND_TASK, async ({ data, error }) => {
  if (error) return;
  await handlePushDataPayload(
    (data as { type?: string; walletId?: string }) ?? {},
  );
});

// Register the task. .catch a benign rejection (e.g., already registered on
// hot-reload during dev). Production register-on-boot is the contract.
Notifications.registerTaskAsync(PUSH_BACKGROUND_TASK).catch(() => undefined);

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function wipeFirstBootIfNeeded() {
  await performFirstBootWipeIfNeeded({
    getDataVersion: (key) => AsyncStorage.getItem(key),
    setDataVersion: (key, value) => AsyncStorage.setItem(key, value),
    clearAllData: () => AsyncStorage.clear(),
    deleteSecureKeys: async (keys) => {
      await Promise.all(
        keys.map((key) =>
          SecureStore.deleteItemAsync(key, SECURE_OPTIONS).catch(
            () => undefined,
          ),
        ),
      );
    },
  });
}

function AppStateListener() {
  const lock = useLockStore((s) => s.lock);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prevState = appStateRef.current;

        if (prevState === "active" && nextState !== "active") {
          // App going to background: lock as before
          lock();
        } else if (prevState !== "active" && nextState === "active") {
          // App returning from background: check if mid-PIN-creation
          const currentRoute = navigationRef.current?.getCurrentRoute()?.name;
          if (currentRoute === "PINCreate" || currentRoute === "PINConfirm") {
            // Reset to Welcome — PIN not stored yet; user must press Get Started again
            navigationRef.current?.reset({
              index: 0,
              routes: [{ name: "Welcome" }],
            });
          }
          // re-read OS permission state on foreground.
          // Drives the permission-revoked-in-os-settings UI state in
          // NotificationsScreen via TanStack invalidation of ["push-prefs"]
          // (the screen re-runs getPermissionsAsync on its own AppState
          // change listener; this top-level call keeps OS-side state
          // warm for fast read).
          Notifications.getPermissionsAsync().catch(() => undefined);
        }

        appStateRef.current = nextState;
      },
    );
    return () => subscription.remove();
  }, [lock]);

  return null;
}

// / — push listeners (token rotation +
// Android foreground path). Implementation lives in
// src/lib/pushListenersSetup.tsx; extracted from App.tsx so unit tests
// can import the component without the entire navigation tree (avoids
// the expo-modules-core ESM transform pitfall in jest CJS —
// Rule 3 deviation). See pushListenersSetup.tsx for the locked behaviour
// (REAL re-registration via services.push.registerPush + never-auto-
// register-a-never-opted-in-user guard + W-7 walletListStore field
// nextReceiveAddress).
//
// Note: the import above (PushListenersSetup) is the ONE consumer in App.tsx,
// mounted inside QueryProvider so the TanStack queryClient is available.

/**
 * Runs on first mount to wipe v1.0 data before any navigation renders,
 * and to initialize the PIN store from SecureStore so AppNavigator can
 * make the correct routing decision synchronously on first render.
 *
 * walletListStore's Zustand persist handles its own hydration via
 * onRehydrateStorage — no manual rehydration call needed here.
 *
 * Race condition note: performFirstBootWipeIfNeeded() and walletListStore's
 * onRehydrateStorage run concurrently. This is intentional and safe:
 * In v1.0 the prl_wallet_registry key did not exist in AsyncStorage.
 * So both orderings produce an empty wallet list — the wipe clears
 * AsyncStorage (including any stale prl_wallet_registry that would never
 * have existed in v1.0), and Zustand finds no persisted data either way.
 * No race guard is needed because both paths converge on an empty store.
 */
function BootHydrator() {
  // / : shared useBootstrapSecurity hook from
  // @prl-wallet/app-flows reads services.secrets.getPinHash() via
  // useAdapters() and flips pinStore.hasPIN/hasPINLoaded — same boot
  // contract as the desktop <HydrationGate>. Mobile passes its
  // wipeFirstBootIfNeeded for the v1.0 → v1.1 first-boot AsyncStorage
  // wipe; desktop omits (defaults to no-op).
  useBootstrapSecurity({ wipeIfNeeded: wipeFirstBootIfNeeded });
  return null;
}

export default function App() {
  return (
    <StoresProvider>
      <MobileAdaptersProvider>
        <QueryProvider>
          <BootHydrator />
          {/* , — UpdateBanner mounted ABOVE AppNavigator
              so the nudge banner / forced modal sit above the navigation
              tree. The component returns null when state === "hidden", so
              there's no wrapper layout cost. */}
          <UpdateBanner />
          <AppNavigator />
          <AppStateListener />
          {/* , — push listeners (token rotation +
              Android foreground path). Inside QueryProvider so the
              TanStack queryClient is available for the cache read. */}
          <PushListenersSetup />
        </QueryProvider>
      </MobileAdaptersProvider>
    </StoresProvider>
  );
}
