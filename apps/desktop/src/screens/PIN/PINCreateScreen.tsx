// apps/desktop/src/screens/PIN/PINCreateScreen.tsx
//
// ( + ) — first half of universal PIN setup.
// Captures 6 digits via <PINGrid>, then passes the captured PIN to
// PINConfirm via React Router state. After confirm matches and stores,
// the auth state machine (App.tsx ) flips to the unlocked tree.
//
// Locked copy (UI-SPEC §PINCreate, lines 156–159):
// H1: "Create your PIN"
// Body: "This 6-digit PIN unlocks every wallet on this device."
// Helper: "PINs are stored as a hash, never as plain text."
//
// Layout: max-w-md mx-auto px-6 py-8 (compactness for setup wizard).
// PINGrid auto-submits on the 6th digit per Pitfall 2 dedup contract.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PINGrid } from "@/components/PINGrid";

export function PINCreateScreen() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");

  const handleComplete = (completed: string) => {
    // T-20-17 mitigation: pass via React Router state (in-memory, no URL
    // exposure since MemoryRouter has no address bar). PINConfirm hashes
    // and stores, then navigates with replace:true so the create-route
    // history entry is replaced.
    navigate("/pin/confirm", { state: { pin: completed } });
  };

  return (
    <main className="bg-background min-h-screen flex items-center justify-center">
      <section className="max-w-md mx-auto px-6 py-8 w-full">
        <h1 className="text-xl font-semibold leading-snug mb-2 text-center">
          Create your PIN
        </h1>
        <p className="text-sm text-muted-foreground mb-2 text-center">
          This 6-digit PIN unlocks every wallet on this device.
        </p>
        <p className="text-xs text-muted-foreground mb-12 text-center">
          PINs are stored as a hash, never as plain text.
        </p>
        <div className="flex justify-center">
          <PINGrid
            value={pin}
            onChange={setPin}
            onComplete={handleComplete}
            autoFocus
          />
        </div>
      </section>
    </main>
  );
}
