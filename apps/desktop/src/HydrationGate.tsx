// apps/desktop/src/HydrationGate.tsx
//
// ( / ) — gates the route tree on full hydration.
// Renders Loader2 spinner until BOTH:
// walletListStore._hasHydrated === true (Zustand persist hydration done)
// pinStore.hasPINLoaded === true (useBootstrapSecurity finished
// reading the PIN hash from the keychain).
//
// Mounts useBootstrapSecurity() once so the second flag actually flips.
// Without this hook the gate would block forever; the architecture diagram
// (RESEARCH.md lines 207-243) places the bootstrap hook EITHER inside the
// gate (this approach) OR a sibling component — both valid. Inside-the-gate
// is simpler: one component owns the load-then-render decision.

import { useStore } from "zustand";
import { useAdapters } from "@prl-wallet/app-adapters";
import { useBootstrapSecurity } from "@prl-wallet/app-flows";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export interface HydrationGateProps {
  children: ReactNode;
}

export function HydrationGate({ children }: HydrationGateProps) {
  // Run the bootstrap effect once. Desktop has no first-boot wipe (v1.3 is
  // greenfield on desktop); the hook defaults to a no-op wipeIfNeeded.
  useBootstrapSecurity();

  const { stores } = useAdapters();
  const hydrated = useStore(stores.walletList, (s) => s._hasHydrated);
  const pinLoaded = useStore(stores.pin, (s) => s.hasPINLoaded);

  if (!hydrated || !pinLoaded) {
    return (
      <div
        className="bg-background min-h-screen flex items-center justify-center"
        role="status"
        aria-label="Loading wallet"
      >
        <Loader2
          className="size-8 text-primary animate-spin"
          aria-hidden="true"
        />
        <span className="sr-only">Loading wallet</span>
      </div>
    );
  }

  return <>{children}</>;
}
