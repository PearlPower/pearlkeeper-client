export const SERVICE_ERROR_CODES = [
  "unknown_network",
  "wallet_not_found",
  "watch_only_wallet",
  "missing_secret",
  "address_discovery_failed",
  "insufficient_funds",
  "broadcast_failed",
  // / C-02:
  "utxo_verification_failed",
  // thrown when no usable signed-config payload is
  // available (backend unreachable + no last-known-good cache + no
  // bundled fallback for this payload type).
  "signed_config_unavailable",
] as const;

export type ServiceErrorCode = (typeof SERVICE_ERROR_CODES)[number];

export interface ServiceError extends Error {
  code: ServiceErrorCode;
  cause?: unknown;
  recoverable?: boolean;
}

/**
 * / C-02 / INDEXER-02: thrown when a UTXO returned by the
 * backend does not consistently round-trip through the locally-known address.
 * Ensures `buildPsbt()` never receives a UTXO whose script directs to an
 * attacker — fund-theft mitigation.
 *
 * Stable `name` + `setPrototypeOf` (Shared Pattern D) so RN bridge / Tauri IPC
 * JSON serialization preserves identity even after the prototype chain is
 * stripped on the wire.
 */
export class UtxoVerificationError extends Error implements ServiceError {
  readonly name = "UtxoVerificationError";
  readonly code: ServiceErrorCode = "utxo_verification_failed";
  /** Snapshot of the offending UTXO (raw shape from the backend). */
  readonly utxo: unknown;
  /** The locally-known xpub-derived address that the UTXO was queried for. */
  readonly expectedAddress: string;
  constructor(message: string, utxo: unknown, expectedAddress: string) {
    super(message);
    this.utxo = utxo;
    this.expectedAddress = expectedAddress;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * / SIGNED-08: thrown when no usable signed-config
 * payload is available — backend unreachable AND no last-known-good
 * cached AND (for non-chain-config) no bundled fallback. Consumers
 * should treat this as "no data" and degrade gracefully (e.g.
 * useSignedConfig surfaces source: "error" + the error message).
 *
 * Stable `name` + `setPrototypeOf` (Shared Pattern D) so RN bridge /
 * Tauri IPC JSON serialization preserves identity even after the
 * prototype chain is stripped on the wire.
 */
export class SignedConfigUnavailableError
  extends Error
  implements ServiceError
{
  readonly name = "SignedConfigUnavailableError";
  readonly code: ServiceErrorCode = "signed_config_unavailable";
  /** The `SignedPayloadType` that had no usable source (e.g., "version-manifest"). */
  readonly payloadType: string;
  /** Optional underlying cause (e.g., the BackendNetworkError that triggered fallthrough). */
  readonly cause?: unknown;
  constructor(message: string, payloadType: string, cause?: unknown) {
    super(message);
    this.payloadType = payloadType;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
