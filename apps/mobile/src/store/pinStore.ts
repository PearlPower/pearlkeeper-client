// Shim: re-binds usePINStore to the singleton instance created at app root
// (see ../providers/StoresProvider). Removed in later plans as call
// sites migrate to useAdapters().stores.pin.
export { pinStoreInstance as usePINStore } from "../providers/StoresProvider";
export type { PINState, PinStore } from "@prl-wallet/app-state";
