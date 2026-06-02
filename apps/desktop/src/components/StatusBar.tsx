// apps/desktop/src/components/StatusBar.tsx
//
// ( + + ).
// Persistent bottom-of-window status bar with the network-gate toggle.
// Lives OUTSIDE the route tree so it's invariant to route changes —
// every screen the wallet ever has ('s Hello/Parity, +
// wallet UI) sees the same bar without per-screen wiring.
//
// Locked copy (UI-SPEC §Copywriting Contract — DO NOT paraphrase):
// "Network: Online" / "Network: Offline" / aria-label "Toggle network access"
//
// Color tokens (UI-SPEC §Color):
// online → bg-accent text-accent-foreground (CSS var; no hex)
// offline → bg-muted text-muted-foreground (neutral; offline is the
// SAFE DEFAULT, not an error state — never use destructive/red)
//
// ( + ):
// Offline height upgraded from h-8 (32 px) to h-12 (48 px) to accommodate the
// " — sensitive ops gated" suffix. neutral-offline invariant is
// preserved verbatim: offline badge uses bg-muted, NEVER bg-destructive.
// Height transition uses `transition-[height] duration-200` (Tailwind v4 native).

import { useStore } from "zustand";
import { Wifi, WifiOff } from "lucide-react";
import { useAdapters } from "@prl-wallet/app-adapters";
import { Switch } from "@/components/ui/switch";
import { UpdateIndicator } from "./UpdateIndicator";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const { stores } = useAdapters();
  const isOpen = useStore(stores.networkGate, (s) => s.isOpen);
  const open = useStore(stores.networkGate, (s) => s.open);
  const close = useStore(stores.networkGate, (s) => s.close);

  return (
    <section
      role="status"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex items-center justify-between px-2",
        "transition-[height] duration-200",
        isOpen ? "h-8" : "h-12",
      )}
    >
      <span
        className={cn(
          "px-1 rounded-sm flex items-center gap-1 text-sm",
          isOpen
            ? "bg-accent text-accent-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isOpen ? (
          <Wifi className="size-3" aria-hidden="true" />
        ) : (
          <WifiOff className="size-3" aria-hidden="true" />
        )}
        {`Network: ${isOpen ? "Online" : "Offline — sensitive ops gated"}`}
      </span>
      <div className="flex items-center gap-4">
        {/* — update indicator. Slot is empty when idle so
            existing layout is unchanged when no update is pending. */}
        <UpdateIndicator />
        <Switch
          checked={isOpen}
          onCheckedChange={(next) => (next ? open() : close())}
          aria-label="Toggle network access"
        />
      </div>
    </section>
  );
}
