// packages/services/src/wallet/factoryReset.ts
//
// / — factory-reset helper.
// Walks the hydrated wallet list (the canonical "which wallets exist" source
// of truth), deletes per-wallet secrets for each, then deletes the global
// PIN hash. Both apps consume; mobile's legacy `deleteAllSecrets` is
// replaced (the legacy version only knew v1.0 keys + the global PIN —
// orphaned per-wallet keys post-v1.1).
//
// NOTE: Caller is responsible for clearing wallet-list metadata from the
// StoragePort (Zustand removeItem or store.reset). This helper only
// touches secrets.
//
// Probe sentinel cleanup is handled by the probe itself (set+read+match+
// delete in Wave 1's secrets_probe). No need to chase it from this helper.

import type { WalletRecord } from "../contracts/index.js";
import type { WalletSecretsPort } from "../ports/storage.js";

export interface DeleteAllSecretsDeps {
  secrets: WalletSecretsPort;
  wallets: ReadonlyArray<WalletRecord>;
}

/**
 * Best-effort wallet-secret wipe. Per-wallet errors are swallowed so a
 * single corrupt entry does not abort the loop — every other wallet still
 * gets cleaned up. The PIN hash deletion runs AFTER all per-wallet deletes
 * complete (Promise.all + await) so PIN is still in place during the
 * per-wallet phase, mirroring mobile's legacy contract.
 */
export async function deleteAllSecrets({
  secrets,
  wallets,
}: DeleteAllSecretsDeps): Promise<void> {
  await Promise.all(
    wallets.map((w) =>
      secrets.deleteWalletSecrets(w.id).catch(() => undefined),
    ),
  );
  await secrets.deletePinHash().catch(() => undefined);
}
