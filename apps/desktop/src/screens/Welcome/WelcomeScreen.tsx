// apps/desktop/src/screens/Welcome/WelcomeScreen.tsx
//
// () — first-launch landing.
// Routes only when !hasWallet || !hasPIN (auth state machine in App.tsx,
// ). UI-SPEC §Welcome locks every string verbatim.
//
// Locked copy (UI-SPEC §Copywriting Contract — DO NOT paraphrase):
// H1 (Display token, text-3xl font-semibold): "Welcome to PRL"
// Body (text-sm font-normal): "Securely manage your Taproot wallets across blockchains."
// CTA (Button size="lg"): "Get started" → /pin/create
//
// Layout (UI-SPEC §Layout Constraints): max-w-md mx-auto px-6 py-8 — compactness
// for the first-launch surface; matches wizard terminal screens (SetupSuccess).

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function WelcomeScreen() {
  const navigate = useNavigate();
  return (
    <main className="bg-background min-h-screen flex items-center justify-center">
      <section className="max-w-md mx-auto px-6 py-8 w-full text-center">
        <h1 className="text-3xl font-semibold leading-tight mb-4">
          Welcome to PRL
        </h1>
        <p className="text-sm font-normal text-muted-foreground mb-12">
          Securely manage your Taproot wallets across blockchains.
        </p>
        <Button
          size="lg"
          className="w-full"
          onClick={() => navigate("/pin/create")}
        >
          Get started
        </Button>
      </section>
    </main>
  );
}
