import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import WalletListScreen from "../screens/WalletList/WalletListScreen";
import WalletDetailScreen from "../screens/WalletDetail/WalletDetailScreen";
import PINUnlockScreen from "../screens/PINUnlockScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import PINCreateScreen from "../screens/PINSetup/PINCreateScreen";
import PINConfirmScreen from "../screens/PINSetup/PINConfirmScreen";
import NewWalletNavigator from "../screens/NewWallet/NewWalletNavigator";
import AddressListScreen from "../screens/AddressList/AddressListScreen";
import TransactionListScreen from "../screens/TransactionList/TransactionListScreen";
import TransactionDetailScreen from "../screens/TransactionDetail/TransactionDetailScreen";
import ReceiveScreen from "../screens/Receive/ReceiveScreen";
import SendNavigator from "../screens/Send/SendNavigator";
import SettingsScreen from "../screens/Settings/SettingsScreen";
import ChangePINScreen from "../screens/Settings/ChangePINScreen";
import NotificationsScreen from "../screens/Settings/NotificationsScreen";
import AnalyticsScreen from "../screens/Settings/AnalyticsScreen";
import { useLockStore } from "../store/lockStore";
import { useWalletListStore } from "../store/walletListStore";
import { usePINStore } from "../store/pinStore";
import { RootStackParamList } from "./types";
import { navigationRef } from "./navigationRef";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

const NO_HEADER: NativeStackNavigationOptions = { headerShown: false };

const PearlTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.cream,
    card: colors.white,
    text: colors.black,
    border: colors.gray300,
    primary: colors.blue600,
  },
};

/**
 * Root navigator. Conditional stack based on wallet/lock/PIN state:
 * !_hasHydrated || !hasPINLoaded → Loading spinner (waiting for store hydration)
 * isLocked && hasWallet → PINUnlock (full-screen overlay)
 * !hasWallet → Onboarding stack (Welcome first; PINCreate gate inside flow)
 * hasWallet && !isLocked → Main app stack (WalletList, WalletDetail, …)
 */
export default function AppNavigator() {
  const isLocked = useLockStore((s) => s.isLocked);
  const hasHydrated = useWalletListStore((s) => s._hasHydrated);
  const wallets = useWalletListStore((s) => s.wallets);
  const hasWallet = wallets.length > 0;
  const hasPINLoaded = usePINStore((s) => s.hasPINLoaded);

  if (!hasHydrated || !hasPINLoaded) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.cream,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={colors.blue600} size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={PearlTheme}>
        <Stack.Navigator screenOptions={NO_HEADER}>
          {isLocked && hasWallet ? (
            <Stack.Screen name="PINUnlock" component={PINUnlockScreen} />
          ) : !hasWallet ? (
            <>
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="PINCreate" component={PINCreateScreen} />
              <Stack.Screen name="PINConfirm" component={PINConfirmScreen} />
              <Stack.Screen
                name="NewWalletFlow"
                component={NewWalletNavigator}
              />
            </>
          ) : (
            <>
              <Stack.Screen name="WalletList" component={WalletListScreen} />
              <Stack.Screen
                name="WalletDetail"
                component={WalletDetailScreen}
              />
              <Stack.Screen
                name="NewWalletFlow"
                component={NewWalletNavigator}
              />
              <Stack.Screen name="AddressList" component={AddressListScreen} />
              <Stack.Screen
                name="TransactionList"
                component={TransactionListScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="TransactionDetail"
                component={TransactionDetailScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Receive"
                component={ReceiveScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="SendFlow"
                component={SendNavigator}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ChangePIN"
                component={ChangePINScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ headerShown: false }}
              />
              {/* — opt-in analytics settings screen. */}
              <Stack.Screen
                name="Analytics"
                component={AnalyticsScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
