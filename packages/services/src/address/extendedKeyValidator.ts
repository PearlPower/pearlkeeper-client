import type { NetworkContext } from "../network/index.js";

/**
 * Thrown when an extended key's base58 prefix doesn't match the network the
 * user is importing into. Surfaced to the UI so the user sees a friendly
 * "this looks like a tpub, not an xpub" instead of an opaque bs58 error
 * thrown from deep in the discovery path — and, more importantly, so the
 * cross-network paste never reaches secure storage.
 */
export class ExtendedKeyNetworkMismatchError extends Error {
  readonly expectedPrefix: string;
  readonly actualPrefix: string;
  readonly networkId: string;

  constructor(opts: {
    expectedPrefix: string;
    actualPrefix: string;
    networkId: string;
  }) {
    super(
      `Extended key for network "${opts.networkId}" must start with "${opts.expectedPrefix}" — got "${opts.actualPrefix}".`,
    );
    this.name = "ExtendedKeyNetworkMismatchError";
    this.expectedPrefix = opts.expectedPrefix;
    this.actualPrefix = opts.actualPrefix;
    this.networkId = opts.networkId;
  }
}

type AllowKind = "private" | "public" | "both";

const PREFIX_SAMPLE_LEN = 4;

/**
 * Reject an extended key whose base58 prefix doesn't match the configured
 * `extendedKeyPrefix` / `extendedPubKeyPrefix` for the given network.
 *
 * This is the primary defense against the cross-network mis-import surfaced
 * in the v1.4 review (`CR-1`): a user pasting a `tpub` into a mainnet wallet
 * (or a legacy `zprv` into the BIP86 Taproot flow) would otherwise be silently
 * accepted by `bitcoinjs-lib`'s `BIP32.fromBase58` whenever the network's
 * version-word pair happens to overlap.
 *
 * The check is intentionally prefix-string based and runs BEFORE any base58
 * decode. The follow-on `BIP32.fromBase58(value, network.network)` call still
 * runs and provides defense-in-depth via the version-word check.
 */
export function assertExtendedKeyMatchesNetwork(
  value: string,
  network: NetworkContext,
  allow: AllowKind,
): void {
  assertExtendedKeyMatchesPrefix(value, {
    networkId: network.config.id,
    extendedKeyPrefix: network.config.extendedKeyPrefix,
    extendedPubKeyPrefix: network.config.extendedPubKeyPrefix,
    allow,
  });
}

/**
 * Lower-level variant that takes only the prefix strings and a network id —
 * intended for callers (e.g. import flows) that already receive
 * `extendedKeyPrefix` / `extendedPubKeyPrefix` as props and don't carry a
 * full `NetworkContext`. Same semantics as
 * `assertExtendedKeyMatchesNetwork`.
 */
export function assertExtendedKeyMatchesPrefix(
  value: string,
  opts: {
    networkId: string;
    extendedKeyPrefix: string;
    extendedPubKeyPrefix: string;
    allow: AllowKind;
  },
): void {
  const { extendedKeyPrefix, extendedPubKeyPrefix, allow, networkId } = opts;

  const privOk =
    (allow === "private" || allow === "both") &&
    value.startsWith(extendedKeyPrefix);
  const pubOk =
    (allow === "public" || allow === "both") &&
    value.startsWith(extendedPubKeyPrefix);

  if (privOk || pubOk) return;

  const expected =
    allow === "private"
      ? extendedKeyPrefix
      : allow === "public"
        ? extendedPubKeyPrefix
        : `${extendedKeyPrefix}|${extendedPubKeyPrefix}`;

  throw new ExtendedKeyNetworkMismatchError({
    expectedPrefix: expected,
    actualPrefix: value.slice(0, PREFIX_SAMPLE_LEN),
    networkId,
  });
}
