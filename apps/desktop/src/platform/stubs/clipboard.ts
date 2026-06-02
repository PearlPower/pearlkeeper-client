// apps/desktop/src/platform/stubs/clipboard.ts
//
// Phase-17 in-memory clipboard stub. swaps for
// @tauri-apps/plugin-clipboard-manager (await app-adapters' contract: setString).

import type { ClipboardPort } from "@prl-wallet/app-adapters";

export const clipboardStub: ClipboardPort = {
  async setString(_text: string) {
    // no-op — wires real OS clipboard
  },
};
