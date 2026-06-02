import React from "react";
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import type { NewWalletStackParamList } from "./services/newWalletFlowTypes";
import { NewWalletProvider } from "./NewWalletContext";
import WalletSetupScreen from "./WalletSetupScreen";
import SeedPhraseScreen from "./CreateWallet/SeedPhrase/SeedPhraseScreen";
import SeedVerifyScreen from "./CreateWallet/SeedVerify/SeedVerifyScreen";
import MnemonicImportScreen from "./ImportWallet/MnemonicImport/MnemonicImportScreen";
import BIP32SeedImportScreen from "./ImportWallet/BIP32SeedImport/BIP32SeedImportScreen";
import XpubImportScreen from "./ImportWallet/XpubImport/XpubImportScreen";
import WalletNameScreen from "./WalletName/WalletNameScreen";
import SetupSuccessScreen from "./SetupSuccess/SetupSuccessScreen";

const Stack = createNativeStackNavigator<NewWalletStackParamList>();

const NO_HEADER: NativeStackNavigationOptions = { headerShown: false };

export default function NewWalletNavigator() {
  return (
    <NewWalletProvider>
      <Stack.Navigator screenOptions={NO_HEADER}>
        <Stack.Screen name="WalletSetup" component={WalletSetupScreen} />
        <Stack.Screen name="SeedPhrase" component={SeedPhraseScreen} />
        <Stack.Screen name="SeedVerify" component={SeedVerifyScreen} />
        <Stack.Screen name="MnemonicImport" component={MnemonicImportScreen} />
        <Stack.Screen
          name="BIP32SeedImport"
          component={BIP32SeedImportScreen}
        />
        <Stack.Screen name="XpubImport" component={XpubImportScreen} />
        <Stack.Screen name="WalletName" component={WalletNameScreen} />
        <Stack.Screen
          name="SetupSuccess"
          component={SetupSuccessScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </NewWalletProvider>
  );
}
