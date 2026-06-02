// apps/desktop/src/platform/networkGate.ts
//
// ( + + ) — desktop NetworkGatePort impl.
//
// FRONTEND CANONICAL, RUST MIRRORS:
// The Zustand networkGateStore is the source of truth. This adapter
// bridges three side-effects on every state change:
// 1. invoke('set_gate_state', { isOpen }) — Rust mirror ()
// 2. queryClient.cancelQueries() on close — abort in-flight (; P-NEW-2)
// 3. onlineManager.setOnline(isOpen) — pause/resume scheduler ()
//
// The useGatedQuery hook ALSO calls cancelQueries({ queryKey })
// on its own subscribe close. Both fire on toggle-off; both are correct.
// We do NOT modify packages/blockbook/src/hooks.ts (P-NEW-7).
//
// Subscriber registration order: ONCE at construction, never torn down.
// The adapter's lifetime equals the app's lifetime.

import { invoke } from "@tauri-apps/api/core";
import { onlineManager, type QueryClient } from "@tanstack/react-query";
import type { NetworkGatePort } from "@prl-wallet/app-adapters";
import type { NetworkGateStore } from "@prl-wallet/app-state";

export function createDesktopNetworkGate(
  store: NetworkGateStore,
  queryClient: QueryClient,
): NetworkGatePort {
  // Side-effect bridge: store → Rust mirror + TanStack manager.
  // Subscribed once at boot; lives for the app lifetime.
  store.subscribe((state, prev) => {
    if (state.isOpen === prev.isOpen) return;
    void invoke("set_gate_state", { isOpen: state.isOpen }).catch(() => {
      // Rust mirror failure is logged but does NOT block the JS-side
      // gate; the front-end short-circuit is the audited path (Finding 2 / P-NEW-3).
      // eslint-disable-next-line no-console
      console.warn("[networkGate] Rust mirror invoke('set_gate_state') failed");
    });
    if (!state.isOpen) {
      // Cancel in-flight FIRST, before pausing the scheduler. Either order
      // works for correctness; this order matches the failure-mode
      // sequence in P-NEW-2 (in-flight aborts; scheduler pauses).
      void queryClient.cancelQueries();
    }
    onlineManager.setOnline(state.isOpen);
  });

  return {
    isOpen: () => store.getState().isOpen,
    subscribe: (listener) =>
      store.subscribe((s, prev) => {
        if (s.isOpen !== prev.isOpen) listener(s.isOpen);
      }),
  };
}
