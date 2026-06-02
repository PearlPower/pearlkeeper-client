// apps/desktop/src/screens/Hello/HelloScreen.tsx
//
// Phase-17 landing screen (UI-SPEC Screen 1, satisfies visual).
// Renders inside Tauri WebView; the dev-only "Open Parity Panel" button
// navigates to /__parity (gated by import.meta.env.DEV in App.tsx).

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function HelloScreen() {
  const navigate = useNavigate();
  const version = import.meta.env.VITE_APP_VERSION ?? "dev";
  const mode = import.meta.env.MODE;

  return (
    <main className="bg-background min-h-screen flex items-center justify-center">
      <section className="bg-card border border-border rounded-lg p-6 max-w-sm w-full">
        <h1 className="text-xl font-semibold mb-2">PRL Desktop</h1>
        <p className="text-sm text-muted-foreground mb-4">
          PRL desktop is alive.
        </p>
        <dl className="text-xs text-muted-foreground space-y-1 mb-4">
          <div className="flex gap-2">
            <dt className="font-medium">Version:</dt>
            <dd>{version}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Build:</dt>
            <dd>{mode}</dd>
          </div>
        </dl>
        {import.meta.env.DEV && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/__parity")}
          >
            Open Parity Panel
          </Button>
        )}
      </section>
    </main>
  );
}
