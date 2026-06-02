// apps/desktop/src/components/MenuController.tsx
//
// context-aware menu enable/disable controller.
//
// Subscribes to lockStore.isLocked, pinStore.hasPIN, walletList.wallets.length,
// and useLocation(). On every change, calls item.setEnabled(...) per the
// truth table.
//
// RESEARCH §Pitfall 4: setEnabled at React-render frequency is acceptable.
// Defensive try/catch wraps every IPC call — Tauri IPC failures must not
// crash the React tree (same posture as lockOnClose.ts T-20-12).
//
// Returns null — side-effect only (StatusBar-like architecture).

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import type { InstalledMenu } from "@/platform/installNativeMenu";

export interface MenuControllerProps {
  installed: InstalledMenu;
}

export function MenuController({ installed }: MenuControllerProps) {
  const location = useLocation();
  const { stores } = useAdapters();
  const hasWallet = useStore(stores.walletList, (s) => s.wallets.length > 0);
  const hasPIN = useStore(stores.pin, (s) => s.hasPIN);
  const isLocked = useStore(stores.lock, (s) => s.isLocked);

  useEffect(() => {
    const inFirstLaunch = !hasWallet || !hasPIN;
    const inWizardRoute =
      location.pathname.startsWith("/wallet/new") ||
      location.pathname.startsWith("/wallet/import");
    // /^\/wallet\/[^/]+$/ also matches /wallet/new and /wallet/import — exclude
    // those so Copy stays disabled on wizard routes per the truth table.
    // Mirrors handleCopyShortcut's wizard-route guard in installNativeMenu.ts.
    const onWalletDetail =
      /^\/wallet\/[^/]+$/.test(location.pathname) && !inWizardRoute;

    // truth table predicates.
    const settingsEnabled = !inFirstLaunch && !isLocked;
    const lockEnabled = !inFirstLaunch && !isLocked;
    const newWalletEnabled = !inFirstLaunch && !isLocked && !inWizardRoute;
    const copyEnabled = !inFirstLaunch && !isLocked && onWalletDetail;

    try {
      void installed.items.settings.setEnabled(settingsEnabled);
      void installed.items.lock.setEnabled(lockEnabled);
      void installed.items.newWallet.setEnabled(newWalletEnabled);
      void installed.items.copy.setEnabled(copyEnabled);
    } catch {
      // Defensive — Tauri IPC failure must not crash the React tree.
    }
  }, [hasWallet, hasPIN, isLocked, location.pathname, installed]);

  return null;
}
