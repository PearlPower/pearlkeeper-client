// apps/desktop/src/__tests__/_harness/__tests__/harness.test.tsx
//
// Task 3 — TDD self-test for the generic test harness.
//
// Verifies the contract every Wave 2/3 plan will rely on:
// renderUnderHarness mounts QueryClient + AdaptersProvider + MemoryRouter
// buildTestBundle returns FRESH bundles (T-20-02 — no module-level state)
// networkGateOpen flag flips bundle.stores.networkGate.getState().isOpen
// BEFORE the screen renders (Pitfall 8 — stops gated queries from blocking)
// prepopulate callback runs synchronously before render
// QueryClient defaults are retry: false / gcTime: 0 / staleTime: 0 (Pitfall 8)
// walletList store reports _hasHydrated === true synchronously after mount
// (in-memory storage adapter resolves persist hydration immediately)
// seedWallet returns fully-typed Wallet objects (W-11 — replaces `as never`)

import { describe, it, expect } from "vitest";
import { screen, act } from "@testing-library/react";
import type { WalletRecord } from "@prl-wallet/app-state";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useStore } from "zustand";
import { renderUnderHarness } from "../TestHarness";
import { buildTestBundle, seedWallet } from "../factories";

describe(" test harness — TestHarness + buildTestBundle + seedWallet", () => {
  it("Test 1: renderUnderHarness mounts a route element", () => {
    renderUnderHarness({
      routes: [{ path: "/", element: <div>hello</div> }],
    });
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("Test 2: buildTestBundle returns a fresh bundle on every call (T-20-02)", () => {
    const bundleA = buildTestBundle();
    const bundleB = buildTestBundle();

    // Mutate A; B must NOT observe the mutation
    act(() => {
      bundleA.stores.walletList.getState().addWallet({
        id: "wallet-A",
        name: "A",
        networkId: "btc-testnet",
        createdAt: 0,
      });
    });

    expect(bundleA.stores.walletList.getState().wallets).toHaveLength(1);
    expect(bundleB.stores.walletList.getState().wallets).toHaveLength(0);
  });

  it("Test 3: networkGateOpen=true flips isOpen BEFORE render (Pitfall 8)", () => {
    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <div>gate-test</div> }],
      networkGateOpen: true,
    });

    expect(bundle.stores.networkGate.getState().isOpen).toBe(true);
    expect(screen.getByText("gate-test")).toBeInTheDocument();
  });

  it("Test 4: prepopulate runs before render and AdaptersProvider sees populated state", () => {
    function ReadHasPin() {
      // Read pin store state via useStore
      // (exercises the AdaptersProvider/useAdapters contract)
      // We import useAdapters lazily via a wrapper
      return null;
    }

    let observedHasPIN: boolean | null = null;

    const { bundle } = renderUnderHarness({
      routes: [
        {
          path: "/",
          element: (
            <Probe
              onRead={(v) => {
                observedHasPIN = v;
              }}
            >
              <ReadHasPin />
            </Probe>
          ),
        },
      ],
      prepopulate: (b) => b.stores.pin.getState().setHasPIN(true),
    });

    expect(bundle.stores.pin.getState().hasPIN).toBe(true);
    expect(observedHasPIN).toBe(true);
  });

  it("Test 5: QueryClient defaults are retry: false, gcTime: 0, staleTime: 0", () => {
    const { queryClient } = renderUnderHarness({
      routes: [{ path: "/", element: <div>qc</div> }],
    });

    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(false);
    expect(defaults.queries?.gcTime).toBe(0);
    expect(defaults.queries?.staleTime).toBe(0);
    expect(defaults.mutations?.retry).toBe(false);
  });

  it("Test 6: walletList _hasHydrated flips to true after a microtask flush", async () => {
    const { bundle } = renderUnderHarness({
      routes: [{ path: "/", element: <div>hydrated</div> }],
    });

    // Zustand persist hydration is async (StoragePort.getItem returns a
    // Promise) — even with an in-memory Map, hydration completes on the
    // next microtask. Wave 2/3 screen tests rely on this flag being true
    // before they assert against rendered content; a single `await` is
    // sufficient to flush the persist resolver. Documenting the contract
    // here so screen tests can copy the pattern.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bundle.stores.walletList.getState()._hasHydrated).toBe(true);
  });

  it("Test 7 (W-11): seedWallet returns a fully-typed Wallet with overrides", () => {
    // Typecheck-only assertion — fails at compile time if seedWallet's
    // return type drifts from WalletRecord.
    const w: WalletRecord = seedWallet();
    expect(w.id).toMatch(/^test-wallet-\d+$/);
    expect(w.name).toMatch(/^Test Wallet \d+$/);
    expect(w.networkId).toBe("btc-testnet");
    expect(typeof w.createdAt).toBe("number");

    const custom = seedWallet({ name: "Custom" });
    expect(custom.name).toBe("Custom");
    expect(custom.networkId).toBe("btc-testnet"); // default still applied
  });
});

// Probe component — reads pin store via the AdaptersProvider context and
// reports the value to the test scope. Lives at module bottom to keep the
// describe block readable; the `useAdapters` import is hoisted to the top
// alongside the rest of the file's imports (IN-09).
function Probe({
  onRead,
  children,
}: {
  onRead: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  const { stores } = useAdapters();
  const hasPIN = useStore(stores.pin, (s) => s.hasPIN);
  onRead(hasPIN);
  return <>{children}</>;
}
