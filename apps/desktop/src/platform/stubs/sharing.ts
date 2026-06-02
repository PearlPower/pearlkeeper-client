// apps/desktop/src/platform/stubs/sharing.ts
//
// Phase-17 no-op sharing stub. Tauri 2 has no system "share" API equivalent
// to mobile share-sheets; v1.3 may never need a real implementation.

import type { SharingPort } from "@prl-wallet/app-adapters";

export const sharingStub: SharingPort = {
  async share(_message: string) {
    // no-op
  },
};
