// apps/desktop/src/App.tsx
//
// auth state machine + W-8 single NewWalletProvider wrapper.
//
// Three trees, selected by reading the wallet/PIN/lock stores:
// 1. !hasWallet || !hasPIN → first-launch tree (Welcome / PIN setup / NewWalletFlow)
// 2. hasWallet && hasPIN && isLocked → locked tree (any path → PINUnlockScreen)
// 3. else → unlocked main tree (wallets / wallet/:id / etc.)
//
// Pitfall 1 belt-and-suspenders: each tree includes a catch-all
// `<Route path="*" element={<Navigate ... replace />} />` so the post-wizard
// tree-flip never strands the user on a stale route.
//
// W-8: NewWalletProvider wraps the conditional <Routes> ONCE (not per branch)
// so wizard state survives the auth-tree flip that fires when setHasPIN(true) +
// addWallet(...) execute inside SetupSuccess. Mounting it twice would re-mount
// the provider on flip and reset its state.
//
// invariants preserved:
// <MemoryRouter initialEntries={["/"]}> (Tauri WebView has no address bar)
// <StatusBar /> as a sibling of <main> outside <MemoryRouter>
// <main className="flex-1 overflow-auto"> (P-NEW-9 scroll room above the bar)
//
// UI-SPEC §Toast positioning (lines 348–352): <Toaster position="bottom-right"
// offset={48} /> — 32px StatusBar + 16px gap.

import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import type { ReactNode } from "react";

import { StatusBar } from "./components/StatusBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { Toaster } from "./components/ui/sonner";
import { MenuController } from "./components/MenuController";
import { subscribeMenu, getInstalledMenu } from "./platform/installNativeMenu";
import {
  setNavigateBridge,
  setRouteBridge,
} from "./platform/menuNavigateBridge";

import { WelcomeScreen } from "./screens/Welcome/WelcomeScreen";
import { PINCreateScreen } from "./screens/PIN/PINCreateScreen";
import { PINConfirmScreen } from "./screens/PIN/PINConfirmScreen";
import { PINUnlockScreen } from "./screens/PIN/PINUnlockScreen";
import { ChangePINScreen } from "./screens/PIN/ChangePINScreen";
import { WalletListScreen } from "./screens/WalletList/WalletListScreen";
import { WalletDetailScreen } from "./screens/WalletDetail/WalletDetailScreen";
import { TransactionsScreen } from "./screens/Transactions/TransactionsScreen";
import { AddressesScreen } from "./screens/Addresses/AddressesScreen";
import { NewWalletProvider } from "./screens/NewWallet/NewWalletProvider";
import { WalletSetupScreen } from "./screens/NewWallet/WalletSetupScreen";
import { SeedPhraseScreen } from "./screens/NewWallet/CreateWallet/SeedPhraseScreen";
import { SeedVerifyScreen } from "./screens/NewWallet/CreateWallet/SeedVerifyScreen";
import { ImportTypePickerScreen } from "./screens/NewWallet/ImportWallet/ImportTypePickerScreen";
import { MnemonicImportScreen } from "./screens/NewWallet/ImportWallet/MnemonicImportScreen";
import { BIP32SeedImportScreen } from "./screens/NewWallet/ImportWallet/BIP32SeedImportScreen";
import { XpubImportScreen } from "./screens/NewWallet/ImportWallet/XpubImportScreen";
import { WalletNameScreen } from "./screens/NewWallet/WalletNameScreen";
import { SetupSuccessScreen } from "./screens/NewWallet/SetupSuccessScreen";
import { SettingsScreen } from "./screens/Settings/SettingsScreen";
import { ParityScreen } from "./screens/Parity/ParityScreen";
import { ReceiveScreen } from "@/screens/Receive/ReceiveScreen";
import { SendLayout } from "@/screens/Send/SendLayout";
import { MasterDetailLayout } from "./screens/MasterDetailLayout";
import { SendAddressScreen } from "@/screens/Send/SendAddressScreen";
import { SendAmountScreen } from "@/screens/Send/SendAmountScreen";
import { SendFeeScreen } from "@/screens/Send/SendFeeScreen";
import { SendReviewScreen } from "@/screens/Send/SendReviewScreen";
import { SendSuccessScreen } from "@/screens/Send/SendSuccessScreen";

/**
 * populates module-scope navigation bridges (in main.tsx) so the
 * native menu's action handlers (which run outside the React tree) can
 * perform react-router-dom navigation and read the current pathname.
 * Mounted INSIDE <MemoryRouter> exactly once.
 */
function NavigateBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    setNavigateBridge((path) => navigate(path));
    return () => setNavigateBridge(null);
  }, [navigate]);
  useEffect(() => {
    setRouteBridge(location.pathname);
  }, [location.pathname]);
  return null;
}

/**
 * W-1 fix: subscribes to installNativeMenu's module-scope subscriber
 * set via useSyncExternalStore. When the async install resolves, the
 * subscriber fires and React re-renders this component, mounting
 * <MenuController /> with the live InstalledMenu ref. No race between the
 * async install promise and the first render — useSyncExternalStore
 * guarantees we re-render whenever the external store notifies us, even if
 * the notify happens before this component first mounts.
 */
function MenuControllerMount() {
  const menu = useSyncExternalStore(
    subscribeMenu,
    getInstalledMenu,
    () => null,
  );
  if (!menu) return null;
  return <MenuController installed={menu} />;
}

export default function App() {
  const { stores } = useAdapters();
  const hasWallet = useStore(stores.walletList, (s) => s.wallets.length > 0);
  const hasPIN = useStore(stores.pin, (s) => s.hasPIN);
  const isLocked = useStore(stores.lock, (s) => s.isLocked);

  let routesTree: ReactNode;

  if (!hasWallet || !hasPIN) {
    // First-launch tree: Welcome → PIN setup → NewWalletFlow (combined).
    // Wizard routes (/wallet/new/*, /wallet/import/*) are reachable here so
    // the user can pick chain/network and start a create or import flow as
    // soon as the PIN is set ( mirrors mobile WelcomeScreen → PINCreate
    // → PINConfirm → NewWalletFlow).
    routesTree = (
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/pin/create" element={<PINCreateScreen />} />
        <Route path="/pin/confirm" element={<PINConfirmScreen />} />
        <Route path="/wallet/new" element={<WalletSetupScreen />} />
        <Route path="/wallet/new/seed" element={<SeedPhraseScreen />} />
        <Route path="/wallet/new/verify" element={<SeedVerifyScreen />} />
        <Route path="/wallet/new/name" element={<WalletNameScreen />} />
        <Route path="/wallet/new/done" element={<SetupSuccessScreen />} />
        <Route path="/wallet/import" element={<ImportTypePickerScreen />} />
        <Route
          path="/wallet/import/mnemonic"
          element={<MnemonicImportScreen />}
        />
        <Route
          path="/wallet/import/bip32"
          element={<BIP32SeedImportScreen />}
        />
        <Route path="/wallet/import/xpub" element={<XpubImportScreen />} />
        <Route path="/wallet/import/name" element={<WalletNameScreen />} />
        <Route path="/wallet/import/done" element={<SetupSuccessScreen />} />
        {import.meta.env.DEV && (
          <Route path="/__parity" element={<ParityScreen />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  } else if (isLocked) {
    // Locked tree: any route renders PINUnlockScreen. After successful unlock,
    // the lockStore.isLocked flip re-renders App which falls through to the
    // unlocked tree.
    //
    // WR-04: anchor the locked tree at an explicit `/pin/unlock` route so the
    // URL is deterministic while locked. If a stale programmatic
    // `navigate(...)` from a deferred effect of the previous tree fires
    // while we're locked, the catch-all redirect drops it onto
    // `/pin/unlock`. Once the user unlocks, the unlocked tree's `*` redirect
    // sends them to `/wallets` from a known-safe URL. This also keeps
    // `routeParams.ts` (which declares `/pin/unlock`) consistent with the
    // route table (IN-02).
    routesTree = (
      <Routes>
        <Route path="/pin/unlock" element={<PINUnlockScreen />} />
        <Route path="*" element={<Navigate to="/pin/unlock" replace />} />
      </Routes>
    );
  } else {
    // Unlocked main tree.
    //
    // Master/detail layout wraps wallet routes + Settings (sidebar visible
    // throughout). Wizards, PIN, dev parity, and the catch-all stay outside
    // the wrapper so they render full-width single-column.
    routesTree = (
      <Routes>
        <Route element={<MasterDetailLayout />}>
          <Route path="/wallets" element={<WalletListScreen />} />
          <Route path="/wallet/:id" element={<WalletDetailScreen />} />
          <Route
            path="/wallet/:id/transactions"
            element={<TransactionsScreen />}
          />
          <Route path="/wallet/:id/addresses" element={<AddressesScreen />} />
          <Route path="/wallet/:id/receive" element={<ReceiveScreen />} />
          <Route path="/wallet/:id/send" element={<SendLayout />}>
            <Route index element={<Navigate to="address" replace />} />
            <Route path="address" element={<SendAddressScreen />} />
            <Route path="amount" element={<SendAmountScreen />} />
            <Route path="fee" element={<SendFeeScreen />} />
            <Route path="review" element={<SendReviewScreen />} />
            <Route path="success" element={<SendSuccessScreen />} />
          </Route>
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/change-pin" element={<ChangePINScreen />} />
        </Route>

        {/* Full-width routes outside the master/detail wrapper () */}
        <Route path="/wallet/new" element={<WalletSetupScreen />} />
        <Route path="/wallet/new/seed" element={<SeedPhraseScreen />} />
        <Route path="/wallet/new/verify" element={<SeedVerifyScreen />} />
        <Route path="/wallet/new/name" element={<WalletNameScreen />} />
        <Route path="/wallet/new/done" element={<SetupSuccessScreen />} />
        <Route path="/wallet/import" element={<ImportTypePickerScreen />} />
        <Route
          path="/wallet/import/mnemonic"
          element={<MnemonicImportScreen />}
        />
        <Route
          path="/wallet/import/bip32"
          element={<BIP32SeedImportScreen />}
        />
        <Route path="/wallet/import/xpub" element={<XpubImportScreen />} />
        <Route path="/wallet/import/name" element={<WalletNameScreen />} />
        <Route path="/wallet/import/done" element={<SetupSuccessScreen />} />
        {import.meta.env.DEV && (
          <Route path="/__parity" element={<ParityScreen />} />
        )}
        <Route path="*" element={<Navigate to="/wallets" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 overflow-auto">
        <MemoryRouter initialEntries={["/"]}>
          {/*
             — NavigateBridge keeps module-scope refs in main.tsx
            current so menu action handlers can navigate and read the
            current pathname. Always mounted (cheap; no UI; lifetime = app).
          */}
          <NavigateBridge />
          {/*
            W-8: Single NewWalletProvider wraps the entire conditional
            <Routes>. Mounting it ONCE above the conditional means wizard
            state (mnemonic, chain/network selection) survives the auth-tree
            flip that fires when setHasPIN(true) + addWallet(...) execute
            inside SetupSuccess. Mounting it twice (once per branch) would
            re-mount the provider on flip and reset its state.
          */}
          <NewWalletProvider>
            {/*
               W-1: MenuControllerMount uses useSyncExternalStore
              to subscribe to installNativeMenu's module-scope subscriber
              set. When the async install resolves it mounts MenuController
              with the live InstalledMenu — truth-table enable/disable
              applies in every auth tree (controller flips items off in
              first-launch / locked).
            */}
            <MenuControllerMount />
            {routesTree}
          </NewWalletProvider>
        </MemoryRouter>
      </main>
      <StatusBar />
      <UpdateBanner />
      <Toaster position="bottom-right" offset={48} />
    </div>
  );
}
