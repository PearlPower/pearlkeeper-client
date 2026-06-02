// Shim: re-binds useWalletListStore to the singleton instance created at app
// root (see ../providers/StoresProvider). Preserves all types previously
// declared inline in this file by re-exporting them from @prl-wallet/app-state.
// Later plans (16-03..16-06) migrate call sites to `useAdapters().stores.*`
// and remove this shim.
export { walletListStoreInstance as useWalletListStore } from "../providers/StoresProvider";
export type {
  WalletType,
  WalletRecord,
  WalletRegistry,
  WalletListState,
  WalletListStore,
} from "@prl-wallet/app-state";
