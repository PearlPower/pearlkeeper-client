// Shim: re-binds useLockStore to the singleton instance created at app root
// (see ../providers/StoresProvider). Removed in later plans as call
// sites migrate to useAdapters().stores.lock.
export { lockStoreInstance as useLockStore } from "../providers/StoresProvider";
export type { LockState, LockStore } from "@prl-wallet/app-state";
