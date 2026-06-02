// apps/desktop/src/lib/getBlockbookClient.ts
// / Pitfall C-NEW-03 + C-NEW-11 — façade-backed.
//
// Pre-Phase-28: this file constructed a real BlockbookClient and cached
// by networkId, mirroring the mobile pattern. Post-Phase-28: it returns
// a BlockbookClient-shaped façade backed by the BackendApiClient instance
// owned by createServicePorts.
//
// The hook callsites (useWalletBalance + useWalletTransactionHistory in
// apps/desktop/src/screens/WalletDetail/WalletDetailScreen.tsx — Pitfall
// C-NEW-11) compile unchanged because the façade exposes the same public
// surface (ping / getAddress / getTx / getUtxos / estimateFee / sendTx).
//
// The networkGate + fetchImpl args are preserved for backward-compat
// but ignored — both live on the shared BackendApiClient now (the
// underlying client was constructed inside createServicePorts with the
// real gate + scopedFetch wired in).

import {
  createBackendBlockbookClient,
  type BackendApiClient,
  type BlockbookClientLike,
} from "@prl-wallet/api-client";
import type { NetworkId } from "@prl-wallet/api-schemas";
import type { NetworkGatePort } from "@prl-wallet/app-adapters";

let _sharedApiClient: BackendApiClient | undefined;

/** Called once by createServicePorts at boot to install the shared client. */
export function setSharedApiClient(client: BackendApiClient): void {
  _sharedApiClient = client;
}

/**
 * Test-only: clears the shared client so a subsequent createServicePorts()
 * call wires a fresh instance. Production code never calls this.
 */
export function __resetBlockbookClientCache(): void {
  _sharedApiClient = undefined;
}

/**
 * Backward-compat wrapper: hook callsites still call
 * getBlockbookClient(networkId, networkGate, fetchImpl). Post-Phase-28 this
 * returns a BlockbookClient-shaped façade — NOT a real BlockbookClient.
 * The networkGate + fetchImpl args are accepted but ignored (both live on
 * the shared apiClient).
 */
export function getBlockbookClient(
  networkId: string,
  _networkGate?: NetworkGatePort,
  // eslint-disable-next-line no-restricted-globals -- type-only reference; runtime fetch is owned by scopedFetch.ts
  _fetchImpl?: typeof fetch,
): BlockbookClientLike {
  if (!_sharedApiClient) {
    throw new Error(
      "getBlockbookClient called before createServicePorts. " +
        "createServicePorts must run at boot to install the shared BackendApiClient ().",
    );
  }
  return createBackendBlockbookClient(
    networkId as NetworkId,
    _sharedApiClient,
  );
}
