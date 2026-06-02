// packages/app-state/src/networkGateStore.ts
//
// () — networkGateStore factory now accepts a StoragePort and
// persists isOpen under top-level key 'prl-network-gate' in wallet-state.json.
// First-launch default: isOpen: false (desktop boots offline).
//
// Mobile is unaffected: mobile uses `networkGateStub` directly and never
// instantiates this factory in the live tree ().

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StoragePort } from "./storagePort.js";

export interface NetworkGateState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export function createNetworkGateStore(storage: StoragePort) {
  return create<NetworkGateState>()(
    persist(
      (set) => ({
        // First-launch default: offline (). On a fresh install with
        // no persisted state, this is what the user sees. Subsequent
        // launches load the persisted value.
        isOpen: false,
        open: () => set({ isOpen: true }),
        close: () => set({ isOpen: false }),
      }),
      {
        name: "prl-network-gate",
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({ isOpen: state.isOpen }),
      },
    ),
  );
}

export type NetworkGateStore = ReturnType<typeof createNetworkGateStore>;
