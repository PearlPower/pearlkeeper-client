import React, { useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  AdaptersProvider as CoreAdaptersProvider,
  type AdaptersBundle,
} from "@prl-wallet/app-adapters";
import { createServicePorts } from "../services/adapters/createServicePorts";
import { networkGateStub } from "../platform/networkGateStub";
import {
  walletListStoreInstance,
  pinStoreInstance,
  lockStoreInstance,
  networkGateStoreInstance,
} from "./StoresProvider";

/**
 * Mobile-side AdaptersProvider. Wires platform-specific port implementations
 * (expo-clipboard, React Native Share, AsyncStorage) + the always-open
 * NetworkGatePort stub () + the module-scoped store singletons created
 * in StoresProvider + the single createServicePorts() call (Pitfall 10 —
 * createServicePorts never runs inside shared hooks).
 */
export function MobileAdaptersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const bundle = useMemo<AdaptersBundle>(
    () => ({
      ports: {
        clipboard: {
          setString: (text) =>
            Clipboard.setStringAsync(text).then(() => undefined),
        },
        sharing: {
          share: async (message) => {
            await Share.share({ message });
          },
        },
        storage: {
          getItem: (k) => AsyncStorage.getItem(k),
          setItem: (k, v) => AsyncStorage.setItem(k, v),
          removeItem: (k) => AsyncStorage.removeItem(k),
        },
        networkGate: networkGateStub,
        clock: { now: () => Date.now() },
      },
      services: createServicePorts({ networkGate: networkGateStub }),
      stores: {
        walletList: walletListStoreInstance,
        pin: pinStoreInstance,
        lock: lockStoreInstance,
        networkGate: networkGateStoreInstance,
      },
    }),
    [],
  );
  return <CoreAdaptersProvider value={bundle}>{children}</CoreAdaptersProvider>;
}
