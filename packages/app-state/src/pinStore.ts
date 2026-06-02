import { create } from "zustand";

export interface PINState {
  hasPIN: boolean;
  hasPINLoaded: boolean;
  setHasPIN: (v: boolean) => void;
  setHasPINLoaded: (v: boolean) => void;
}

/**
 * Factory for the PIN state store. PIN state is ephemeral — the boolean only
 * reflects whether the SecureStore-backed PIN exists; no PIN material ever
 * lives in this store. No StoragePort is required (see 16-RESEARCH.md Open
 * Question #3).
 */
export function createPinStore() {
  return create<PINState>((set) => ({
    hasPIN: false,
    hasPINLoaded: false,
    setHasPIN: (v) => set({ hasPIN: v }),
    setHasPINLoaded: (v) => set({ hasPINLoaded: v }),
  }));
}

export type PinStore = ReturnType<typeof createPinStore>;
