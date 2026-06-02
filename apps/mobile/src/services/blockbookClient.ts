// apps/mobile/src/services/blockbookClient.ts
// / Pitfall C-NEW-03 / /
//
// Pre-Phase-28: this file constructed a real BlockbookClient and cached
// by networkId. Post-Phase-28: it returns a BlockbookClient-shaped façade
// backed by the BackendApiClient instance owned by createServicePorts.
//
// The 7 mobile hook callsites in apps/mobile/src/{components,screens,services}
// (BalanceSection, AddressList, TransactionList, TransactionDetail,
// SendFlowContext, WalletList, discoverAddresses) compile UNCHANGED because
// the façade exposes the same public surface (getAddress, getTx, getUtxos,
// sendTx, estimateFee, ping).
//
// The networkGate arg is preserved for backward-compat but ignored — the
// underlying BackendApiClient holds the real gate ( layer 3 still
// short-circuits before any fetch, just at the BackendApiClient seam now).

import {
  createBackendBlockbookClient,
  type BackendApiClient,
  type BlockbookClientLike,
} from "@prl-wallet/api-client";
import type { NetworkId } from "@prl-wallet/api-schemas";

let _sharedApiClient: BackendApiClient | undefined;

/** Called once by createServicePorts at boot. */
export function setSharedApiClient(client: BackendApiClient): void {
  _sharedApiClient = client;
}

/**
 * Test/reset helper — clears the shared client so a subsequent
 * createServicePorts() call wires a fresh instance.
 */
export function __resetClientCache(): void {
  _sharedApiClient = undefined;
}

/**
 * Backward-compat wrapper: hook callsites still call
 * getBlockbookClient(networkId, networkGate). Post-Phase-28 this returns
 * a BlockbookClient-shaped façade — NOT a real BlockbookClient. The
 * networkGate arg is ignored (gate lives on the shared apiClient).
 */
export function getBlockbookClient(
  networkId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _networkGate?: { isOpen(): boolean },
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
