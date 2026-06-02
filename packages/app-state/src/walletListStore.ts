import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StoragePort } from "./storagePort.js";

// 'wif' retained as legacy alias — new seed imports use 'bip32Seed'
export type WalletType = "mnemonic" | "wif" | "bip32Seed" | "xpub";

/**
 * Non-secret wallet metadata persisted via the injected StoragePort.
 * walletType is intentionally ABSENT — it lives in secure storage only
 * under wallet_<id>_type to avoid leaking key material type to
 * unprotected storage.
 */
export interface WalletRecord {
  id: string; // UUID v4
  name: string; // User-assigned display name
  networkId: string; // e.g. "prl-mainnet", "btc-mainnet"
  createdAt: number; // Date.now() at creation
  lastKnownBalance?: string; // satoshis as string — updated by WalletDetail on successful fetch
  nextReceiveAddress?: string;
}

export interface WalletRegistry {
  wallets: WalletRecord[];
  activeWalletId: string | null;
}

export interface WalletListState extends WalletRegistry {
  /**
   * Runtime flag — true once Zustand has finished reading from the injected
   * StoragePort. NOT persisted (excluded from partialize). AppNavigator gates
   * rendering on this.
   */
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  /** Wallet ID to navigate to once WalletListScreen mounts. NOT persisted. */
  pendingOpenWalletId: string | null;
  walletBalanceRefreshState: Record<string, boolean>;
  setPendingOpenWalletId: (id: string | null) => void;
  setWalletBalanceRefreshing: (id: string, isRefreshing: boolean) => void;
  addWallet: (record: WalletRecord) => void;
  removeWallet: (id: string) => void;
  setActiveWalletId: (id: string | null) => void;
  updateWalletBalance: (id: string, balance: string) => void;
  updateWalletReceiveAddress: (id: string, address: string) => void;
  /**
   * opt-in analytics consent. Default: not granted
   * (never-decided ≡ not-granted per settings-discovery posture).
   * Persisted via partialize so a granted decision survives process
   * restart, but the in-memory analytics queue is NOT persisted ().
   * Zustand persist default shallow-merge handles this new top-level
   * field without a `version`/`migrate` block (RESEARCH §"Pitfall 5").
   */
  analyticsConsent: { granted: boolean; decidedAt: number | null };
  setAnalyticsConsent: (next: {
    granted: boolean;
    decidedAt: number | null;
  }) => void;
}

/**
 * Factory for the wallet-list Zustand store. Each app (mobile / desktop) calls
 * this once at startup with its own StoragePort implementation (React Native
 * persistent storage on mobile, plugin-store on desktop). Persist `name` is the
 * canonical on-disk key — changing it wipes every current user's wallet list
 * (see threat T-16-05).
 */
export function createWalletListStore(storage: StoragePort) {
  return create<WalletListState>()(
    persist(
      (set) => ({
        wallets: [],
        activeWalletId: null,
        _hasHydrated: false,
        pendingOpenWalletId: null,
        walletBalanceRefreshState: {},
        // never-granted default (settings-discovery posture).
        analyticsConsent: { granted: false, decidedAt: null },
        setAnalyticsConsent: (next) => set({ analyticsConsent: next }),

        setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),
        setPendingOpenWalletId: (id: string | null) =>
          set({ pendingOpenWalletId: id }),
        setWalletBalanceRefreshing: (id: string, isRefreshing: boolean) =>
          set((state) => ({
            walletBalanceRefreshState: {
              ...state.walletBalanceRefreshState,
              [id]: isRefreshing,
            },
          })),

        addWallet: (record: WalletRecord) =>
          set((state) => ({ wallets: [...state.wallets, record] })),

        removeWallet: (id: string) =>
          set((state) => ({
            wallets: state.wallets.filter((w) => w.id !== id),
            walletBalanceRefreshState: Object.fromEntries(
              Object.entries(state.walletBalanceRefreshState).filter(
                ([walletId]) => walletId !== id,
              ),
            ),
            // Clear active selection if the active wallet is deleted
            activeWalletId:
              state.activeWalletId === id ? null : state.activeWalletId,
          })),

        setActiveWalletId: (id: string | null) => set({ activeWalletId: id }),

        updateWalletBalance: (id: string, balance: string) =>
          set((state) => ({
            wallets: state.wallets.map((w) =>
              w.id === id ? { ...w, lastKnownBalance: balance } : w,
            ),
          })),

        updateWalletReceiveAddress: (id: string, address: string) =>
          set((state) => ({
            wallets: state.wallets.map((w) =>
              w.id === id ? { ...w, nextReceiveAddress: address } : w,
            ),
          })),
      }),
      {
        name: "prl_wallet_registry",
        storage: createJSONStorage(() => storage),
        /**
         * Only persist wallets and activeWalletId.
         * _hasHydrated is NEVER persisted — it is always false at startup
         * and set to true by onRehydrateStorage. If it were persisted,
         * it would start as true from a previous session's value, hiding
         * the fact that rehydration has not yet completed.
         */
        partialize: (state) => ({
          wallets: state.wallets,
          activeWalletId: state.activeWalletId,
          // analytics consent decision persists across
          // restart (so a granted decision is honored on next launch).
          analyticsConsent: state.analyticsConsent,
        }),
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);
        },
      },
    ),
  );
}

export type WalletListStore = ReturnType<typeof createWalletListStore>;
