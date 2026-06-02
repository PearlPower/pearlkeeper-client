// apps/desktop/src/main.tsx
//
// Desktop boot sequence:
// 1. assertSecureRandom() — fail-fast if globalThis.crypto.getRandomValues is missing ().
// 2. generateDistinctMnemonics(100) — statistical RNG-pipeline check (; ).
// 3. await invoke('secrets_probe') — set+read+match+delete a sentinel on the OS keychain (/).
// 4a. ON SUCCESS: build the AdaptersBundle with REAL desktop secrets/storage adapters
// (Wave 2 ) and render <AdaptersProvider><HydrationGate><App /></HydrationGate></AdaptersProvider>
// wrapped in <QueryClientProvider> ().
// 4b. ON FAILURE: render <KeychainUnavailableScreen err onRetry /> instead — STATIC, no providers.
// [Retry] re-invokes the probe and (on success) re-renders the full tree.
//
// IIFE wrap (RESEARCH.md OQ#4): top-level await is unstable across our Vite + WebView
// matrix; an immediately-invoked async function preserves the same control flow with
// proven semantics.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  AdaptersProvider,
  type AdaptersBundle,
} from "@prl-wallet/app-adapters";
import {
  createWalletListStore,
  createPinStore,
  createLockStore,
  createNetworkGateStore,
} from "@prl-wallet/app-state";
import { ThemeProvider } from "next-themes";
import {
  assertSecureRandom,
  generateDistinctMnemonics,
} from "@prl-wallet/core";
import App from "./App";
import { HydrationGate } from "./HydrationGate";
import { KeychainUnavailableScreen } from "./KeychainUnavailableScreen";
import { createServicePorts } from "./platform/createServicePorts";
import { createDesktopSecrets } from "./platform/secrets";
import { createDesktopStorage } from "./platform/storage";
import { createDesktopNetworkGate } from "./platform/networkGate";
import { createDesktopQueryClient } from "./platform/queryClient";
import { scopedFetch } from "./platform/scopedFetch";
import { createDesktopClipboard } from "./platform/clipboard";
import { sharingStub } from "./platform/stubs/sharing";
import { clockStub } from "./platform/stubs/clock";
import { installCloseLock } from "./platform/lockOnClose";
import { initIdleLock } from "./platform/idleLock";
import { installNativeMenu } from "./platform/installNativeMenu";
import {
  menuNavigate,
  menuGetRoute,
} from "./platform/menuNavigateBridge";
import { installBlurClear } from "./security/installBlurClear";
import { installLockClear } from "./security/installLockClear";
import * as revealRegistry from "./security/revealRegistry";
import "./index.css";

// QueryClient lives for the app's lifetime — module-scope so both
// buildAdaptersBundle() and the render path reference the same instance.
const queryClient = createDesktopQueryClient();

void (async () => {
  // === : BOOT-TIME ENTROPY GATE () ===
  assertSecureRandom();
  const sample = generateDistinctMnemonics(100);
  if (new Set(sample).size !== 100) {
    throw new Error(
      `FATAL: 100-mnemonic distinctness check failed; ${new Set(sample).size}/100 distinct.`,
    );
  }

  const root = createRoot(document.getElementById("root")!);

  // === / : KEYCHAIN PROBE ===
  // Set+read+match+delete a sentinel via secrets.rs::secrets_probe. Catches
  // missing daemon (Linux), full disk, ACL issues uniformly. Successful on
  // macOS/Windows by default; fails on headless Linux without Secret Service.
  async function probe(): Promise<unknown | null> {
    try {
      await invoke<void>("secrets_probe");
      return null;
    } catch (err) {
      return err;
    }
  }

  // Builds a fresh AdaptersBundle. Called on probe success and on Retry success.
  function buildAdaptersBundle(): AdaptersBundle {
    const storage = createDesktopStorage();
    const secrets = createDesktopSecrets();
    const walletListStore = createWalletListStore(storage);
    const pinStore = createPinStore();
    const lockStore = createLockStore(storage);
    const networkGateStore = createNetworkGateStore(storage);

    const networkGate = createDesktopNetworkGate(networkGateStore, queryClient);

    // boot mirror: after persist hydration, sync Rust to the hydrated
    // isOpen value. Without this, the Rust mutex starts at `false` (lib.rs
    // default) and would briefly diverge from a persisted `true` state for
    // the ~50ms hydration window (P-NEW-8 Path 2).
    const unsubscribe = networkGateStore.persist.onFinishHydration((state) => {
      void invoke("set_gate_state", { isOpen: state.isOpen });
      unsubscribe();
    });

    return {
      ports: {
        clipboard: createDesktopClipboard(),
        sharing: sharingStub,
        storage,
        networkGate,
        clock: clockStub,
      },
      services: createServicePorts({
        secrets,
        walletListStore,
        networkGate,
        fetchImpl: scopedFetch,
      }),
      stores: {
        walletList: walletListStore,
        pin: pinStore,
        lock: lockStore,
        networkGate: networkGateStore,
      },
    };
  }

  function renderApp(): AdaptersBundle {
    const bundle = buildAdaptersBundle();
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <AdaptersProvider value={bundle}>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <HydrationGate>
                <App />
              </HydrationGate>
            </ThemeProvider>
          </AdaptersProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
    return bundle;
  }

  // post-render wiring: install Tauri close-handler + idle auto-lock on
  // the rendered bundle. Both call lockStore.lock() with try/catch wrappers
  // (T-20-12 / T-20-13). Documented in 20-03-SUMMARY.md: if renderApp runs
  // twice (probe-failure → retry-success), only the second call's listeners
  // are active for the lifetime of the app. Tauri allows multiple
  // onCloseRequested listeners on the same event; the duplicate from a
  // probe-failure path is harmless but wasteful — acceptable tradeoff.
  function installPostRenderLocks(bundle: AdaptersBundle): void {
    // lock-on-close: installCloseLock wraps lock() in try/catch (T-20-12).
    void installCloseLock(bundle, getCurrentWindow());

    // idle auto-lock: subscribes to lockStore.idleTimeoutMs.
    // Defensive try/catch around lock() now lives inside initIdleLock; the
    // boot caller no longer needs to wrap it.
    initIdleLock(bundle.stores.lock);

    // clear visible secrets on window blur or auto-lock.
    // Both listeners call revealRegistry.clearAll(); registered surfaces hide via
    // their disabled prop (HoldToReveal.tsx:78-83 onHide pathway).
    void installBlurClear(getCurrentWindow(), () => revealRegistry.clearAll());
    installLockClear(bundle.stores.lock, () => revealRegistry.clearAll());

    // native menu install. Action handlers close over the
    // bundle. The installNativeMenu module owns the InstalledMenu ref + the
    // subscriber set (W-1) — when the async install resolves it notifies
    // subscribers so <MenuControllerMount> in App.tsx (using
    // useSyncExternalStore) re-renders and mounts <MenuController />.
    void installNativeMenu(bundle, menuNavigate, menuGetRoute);
  }

  const probeError = await probe();
  if (probeError) {
    root.render(
      <StrictMode>
        <KeychainUnavailableScreen
          err={probeError}
          onRetry={async () => {
            const retryErr = await probe();
            if (!retryErr) {
              const bundle = renderApp();
              installPostRenderLocks(bundle);
            }
          }}
        />
      </StrictMode>,
    );
  } else {
    const bundle = renderApp();
    installPostRenderLocks(bundle);
  }
})();
