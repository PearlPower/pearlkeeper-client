// packages/services/src/ports/signedConfig.ts —
//
// SignedConfigPort — consumer-facing interface for the implemented
// signed payload types. The adapter (packages/api-client/src/
// signedConfigPortAdapter.ts) ships the only production implementor;
// tests can construct stub implementations from this interface alone.
//
// Method semantics (, ):
// getChainConfig: NEVER-rejecting. Online → fresh; offline +
// populated storage → last-known-good; offline + empty storage →
// bundled-fallback (deps.bundledChainConfig).
// getVersionManifest: online → fresh; offline + populated storage →
// last-known-good; offline + empty storage → throws
// SignedConfigUnavailableError. (No bundled fallback — degrades
// to "no data".)

import type {
  ChainConfigPayload,
  VersionManifestPayload,
} from "@prl-wallet/api-schemas";

export const SIGNED_CONFIG_PORT_METHODS = [
  "getChainConfig",
  "getVersionManifest",
] as const;

export interface SignedConfigPort {
  getChainConfig(): Promise<ChainConfigPayload>;
  getVersionManifest(): Promise<VersionManifestPayload>;
}

/**
 * Re-export the implemented payload types so consumers
 * (createServicePorts.ts, useSignedConfig.ts) have a single import
 * surface from `@prl-wallet/services` rather than reaching into
 * `@prl-wallet/api-schemas` for both interface + payload types.
 */
export type {
  ChainConfigPayload,
  VersionManifestPayload,
} from "@prl-wallet/api-schemas";
