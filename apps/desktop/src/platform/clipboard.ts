// apps/desktop/src/platform/clipboard.ts
// replaces stub in main.tsx AdaptersBundle.
// The stub at apps/desktop/src/platform/stubs/clipboard.ts
// remains importable for tests via factories.ts.
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { ClipboardPort } from "@prl-wallet/app-adapters";

export function createDesktopClipboard(): ClipboardPort {
  return {
    async setString(text: string): Promise<void> {
      await writeText(text);
    },
  };
}
