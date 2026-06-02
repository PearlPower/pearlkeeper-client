// apps/desktop/src/KeychainUnavailableScreen.tsx
//
// ( / ) — full-screen blocking error when the OS
// keychain is unreachable. STATIC: must render with zero context
// dependencies (no AdaptersProvider, no MemoryRouter, no Zustand reads),
// so the user sees this screen even if anything else in the boot path
// would otherwise crash.
//
// Locked copy: every visible string below comes from
//
// §"Copywriting Contract". The string "We never write secrets to plaintext
// files." is LOAD-BEARING ( <specifics>) — never paraphrase.

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@/components/ui/button";

export interface KeychainUnavailableScreenProps {
  /**
   * The SecretError shape from Tauri serde tag/content:
   * { kind: "NoBackend" | "ValueTooLarge" | "AccessDenied" | "Io", data?: ... }
   * Used only for support diagnostics (logged via console.error,
   * never rendered to the user — see T-18-11).
   */
  err: unknown;
  /** Called when [Retry] is clicked. main.tsx re-invokes secrets_probe. */
  onRetry: () => Promise<void>;
}

interface DistroBlock {
  heading: string;
  command: string;
}

const DISTRO_BLOCKS: DistroBlock[] = [
  {
    heading: "Ubuntu / Debian",
    command:
      "sudo apt install gnome-keyring && gnome-keyring-daemon --start --components=secrets",
  },
  {
    heading: "Fedora",
    command:
      "sudo dnf install gnome-keyring && gnome-keyring-daemon --start --components=secrets",
  },
  {
    heading: "Arch / Manjaro",
    command:
      "sudo pacman -S gnome-keyring && gnome-keyring-daemon --start --components=secrets",
  },
  {
    heading: "KDE Plasma",
    command:
      "sudo apt install kwalletmanager kwallet-pam (Debian/Ubuntu) — or use your distro's package manager",
  },
];

export function KeychainUnavailableScreen({
  err,
  onRetry,
}: KeychainUnavailableScreenProps) {
  const [retrying, setRetrying] = useState(false);
  const [quitting, setQuitting] = useState(false);

  // Log err for support diagnostics — never display the raw shape to
  // the user (a crash dump is not user-friendly).
  // eslint-disable-next-line no-console
  console.error("[KeychainUnavailableScreen]", err);

  return (
    <main className="bg-background text-foreground min-h-screen flex items-center justify-center p-12">
      <section className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full space-y-8">
        {/* 1. Icon + Title */}
        <div className="flex items-start gap-3">
          <ShieldAlert
            className="size-8 text-destructive shrink-0"
            aria-hidden="true"
          />
          <h1 className="text-3xl font-semibold leading-tight">
            Pearl Keeper cannot start safely
          </h1>
        </div>

        {/* 2. Body explanation (verbatim from UI-SPEC Copywriting Contract) */}
        <div className="space-y-4 text-sm">
          <p>
            Your wallet&apos;s mnemonic, BIP32 seed, and other secrets must live
            in your operating system&apos;s keychain. We could not reach a
            keychain backend on this system.
          </p>
          <p>
            On Linux, this means a Secret Service daemon —{" "}
            <code className="font-mono text-xs">gnome-keyring</code> (GNOME) or{" "}
            <code className="font-mono text-xs">kwalletd5</code> /{" "}
            <code className="font-mono text-xs">kwalletd6</code> (KDE) — is not
            installed or not running.
          </p>
        </div>

        {/* 3. Install instructions (4 distro sections) */}
        <div className="space-y-6">
          {DISTRO_BLOCKS.map(({ heading, command }) => (
            <div key={heading} className="space-y-2">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
                {heading}
              </h2>
              <pre className="bg-muted text-foreground rounded-md px-4 py-2 font-mono text-sm whitespace-pre overflow-x-auto select-all">
                {command}
              </pre>
            </div>
          ))}
        </div>

        {/* 4. Security claim — LOAD-BEARING literal copy. Do not change. */}
        <p className="text-sm text-muted-foreground italic" role="note">
          We never write secrets to plaintext files.
        </p>

        {/* 5. Button row: [Quit] [Retry] (UI-SPEC: primary on the right) */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            disabled={quitting}
            onClick={async () => {
              setQuitting(true);
              try {
                await getCurrentWindow().close();
              } catch {
                // close() rejection is harmless — the user clicked Quit;
                // there's nothing else to do.
                setQuitting(false);
              }
            }}
          >
            Quit
          </Button>
          <Button
            variant="default"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              try {
                await onRetry();
              } finally {
                setRetrying(false);
              }
            }}
          >
            Retry
          </Button>
        </div>
      </section>
    </main>
  );
}
