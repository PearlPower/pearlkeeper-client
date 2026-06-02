import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StoragePort } from "@prl-wallet/app-adapters";
import {
  createWalletListStore,
  createPinStore,
  createLockStore,
  createNetworkGateStore,
  type WalletListStore,
  type PinStore,
  type LockStore,
  type NetworkGateStore,
} from "@prl-wallet/app-state";

/**
 * Mobile-side StoragePort backed by React Native's AsyncStorage.
 * The shared `@prl-wallet/app-state` factories are platform-agnostic — this
 * file is the only place in the mobile app that references AsyncStorage for
 * the wallet-list persist layer.
 */
const asyncStoragePort: StoragePort = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};

/**
 * Module-scoped singletons. requires each factory to be invoked exactly
 * once per app at startup. Placing the calls at module scope (rather than
 * inside a component render) guarantees a single instance even if React
 * re-mounts the provider tree (e.g. on Fast Refresh).
 */
export const walletListStoreInstance: WalletListStore =
  createWalletListStore(asyncStoragePort);
export const pinStoreInstance: PinStore = createPinStore();
export const lockStoreInstance: LockStore = createLockStore(asyncStoragePort);
// Mobile uses `ports.networkGate` (always-open stub) at runtime; this store
// instance only exists to satisfy the AdaptersBundle.stores contract — no
// shared code reads from it on mobile.
export const networkGateStoreInstance: NetworkGateStore =
  createNetworkGateStore(asyncStoragePort);

/**
 * Pass-through provider. All state lives in the module-scoped instances
 * above; this wrapper is kept so later plans can slot it into the full
 * AdaptersProvider bundle without refactoring the App.tsx tree.
 */
export function StoresProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
