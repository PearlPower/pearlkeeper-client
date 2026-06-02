// apps/desktop/src/__tests__/authStateMachine.test.tsx
//
// Task 3 — App.tsx auth state machine routing contract.
//
// Mounts the real App component (which owns its own <MemoryRouter>) under
// an AdaptersProvider + QueryClientProvider, varies (hasWallet, hasPIN,
// isLocked) via store mutations, and asserts the rendered <h1> matches the
// expected branch. The Pitfall 1 test exercises the catch-all route by
// flipping store state after mount and confirming the tree flips.
//
// W-11: every wallet seeding uses seedWallet({...}) from _harness/factories
// instead of unsafe type assertions, so adding required Wallet fields breaks
// the factory at compile-time (one fix point) instead of fragmenting tests.
//
// Note: jsdom@29 does not implement Element#setPointerCapture, but the App's
// route trees in this test (Welcome / PINUnlock / WalletList) don't touch
// HoldToReveal so no polyfill is required here.

import { describe, test, expect, vi, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  AdaptersProvider,
  type AdaptersBundle,
} from "@prl-wallet/app-adapters";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import { buildTestBundle, seedWallet } from "./_harness/factories"; // W-11

// useBootstrapSecurity reads the secrets port at startup. We stub it so the
// store hydration doesn't accidentally flip pin.hasPIN through hook side-effects.
vi.mock("@prl-wallet/app-flows", async (orig) => {
  const actual = await orig<typeof import("@prl-wallet/app-flows")>();
  return {
    ...actual,
    useBootstrapSecurity: () => {},
  };
});

// Tauri core mock — StatusBar invokes on toggle; not used here but App mounts it.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {}),
}));

// Polyfill setPointerCapture (jsdom@29 lacks it) AND window.matchMedia (sonner
// reads it during effect mount to detect prefers-reduced-motion).
beforeAll(() => {
  if (typeof Element.prototype.setPointerCapture !== "function") {
    Element.prototype.setPointerCapture = function () {};
  }
  if (typeof Element.prototype.releasePointerCapture !== "function") {
    Element.prototype.releasePointerCapture = function () {};
  }
  if (typeof Element.prototype.hasPointerCapture !== "function") {
    Element.prototype.hasPointerCapture = function () {
      return false;
    };
  }
  if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

function renderApp(prepopulate?: (b: AdaptersBundle) => void) {
  const bundle = buildTestBundle();
  if (prepopulate) prepopulate(bundle);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AdaptersProvider value={bundle}>
        <App />
      </AdaptersProvider>
    </QueryClientProvider>,
  );
  return { bundle, queryClient, result };
}

describe("App auth state machine", () => {
  test("(!hasWallet, !hasPIN, !isLocked) → Welcome tree", async () => {
    renderApp((b) => {
      // Default lockStore.isLocked is true; flip to false so the !hasWallet
      // branch is exercised cleanly.
      b.stores.lock.getState().unlock();
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Welcome to PRL",
      }),
    ).toBeInTheDocument();
  });

  test("(hasWallet, hasPIN, isLocked) → PIN unlock tree", async () => {
    renderApp((b) => {
      b.stores.pin.getState().setHasPIN(true);
      // W-11: seedWallet() produces a fully-typed WalletRecord (no unsafe casts).
      b.stores.walletList.getState().addWallet(seedWallet({ id: "w1", name: "Test" }));
      b.stores.lock.getState().lock();
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Enter your PIN",
      }),
    ).toBeInTheDocument();
  });

  test("(hasWallet, hasPIN, !isLocked) → Wallet list tree", async () => {
    renderApp((b) => {
      b.stores.pin.getState().setHasPIN(true);
      b.stores.walletList.getState().addWallet(seedWallet({ id: "w1", name: "My BTC" }));
      b.stores.lock.getState().unlock();
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your wallets" }),
    ).toBeInTheDocument();
  });

  test("Pitfall 1: store flip from Welcome → unlocked re-renders into Wallet list", async () => {
    const { bundle } = renderApp((b) => {
      // Start in the Welcome tree (default — no wallet, no PIN, but unlocked
      // so we don't sit on the locked branch).
      b.stores.lock.getState().unlock();
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Welcome to PRL",
      }),
    ).toBeInTheDocument();

    act(() => {
      bundle.stores.pin.getState().setHasPIN(true);
      bundle.stores.walletList.getState().addWallet(seedWallet({ id: "w1", name: "Test" }));
    });

    // The catch-all in the unlocked tree routes any leftover path → /wallets.
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your wallets" }),
    ).toBeInTheDocument();
  });
});
