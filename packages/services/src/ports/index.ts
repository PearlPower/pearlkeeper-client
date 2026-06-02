import type { BlockbookPortFactory } from "./blockbook.js";
import type { WalletRegistryPort } from "./registry.js";
import type { ServicesRuntime } from "./runtime.js";
import type { WalletSecretsPort } from "./storage.js";
import type { SignedConfigPort } from "./signedConfig.js";
import type { FeeOraclePort } from "./feeOracle.js";
import type { PriceFeedPort } from "./priceFeed.js";
import type { PushServicePort } from "./push.js";
import type { AnalyticsPort } from "./analytics.js";
import type { ReleasesPort } from "./releases.js";

export const PORT_NAMES = [
  "secrets",
  "registry",
  "blockbook",
  "runtime",
  // optional in (no consumers yet); becomes
  // required when .1 chain-config cutover lands.
  "signedConfig",
  // fee oracle + price feed ports. Optional like
  // signedConfig: production wiring (mobile + desktop createServicePorts)
  // ALWAYS supplies them, but test factories that don't exercise
  // fee/price flows can leave the fields undefined.
  "feeOracle",
  "priceFeed",
  // push service port. Optional: desktop omits (
  // push out of scope on desktop); test factories that don't exercise
  // push flows leave it undefined. Mobile production wiring always sets it.
  "push",
  // opt-in analytics port. Mobile + desktop both wire
  // it (full feature parity per UI-SPEC §10, unlike push which is
  // mobile-only). OPTIONAL on the type so test factories that don't
  // exercise analytics can leave it undefined; production wiring
  // ALWAYS supplies it.
  "analytics",
  // Unified release-update mechanism — optional port for the update panel's
  // changelog fetch (mobile + desktop). Test factories that don't exercise
  // the update flow leave it undefined.
  "releases",
] as const;

/**
 * Structural mirror of `@prl-wallet/app-adapters`' `NetworkGatePort`.
 *
 * Declared locally (rather than imported from app-adapters) because
 * app-adapters already depends on @prl-wallet/services for types like
 * `ServicesPorts` and `DerivedAddress` — importing NetworkGatePort from
 * app-adapters would create a cyclic package graph (turbo refuses to build).
 *
 * The shape is identical to app-adapters/NetworkGatePort by structural
 * typing, so both declarations are interchangeable at call sites.
 */
export interface NetworkGatePort {
  isOpen(): boolean;
  subscribe(listener: (open: boolean) => void): () => void;
}

export interface ServicesPorts {
  secrets: WalletSecretsPort;
  registry: WalletRegistryPort;
  blockbook: BlockbookPortFactory;
  runtime: ServicesRuntime;
  /**
   * Optional network gate — when supplied, the app wires a `NetworkGatePort`
   * into each `BlockbookClient` via the factory so fetches short-circuit while
   * the gate is closed ( + ). Mobile uses an always-open stub;
   * desktop () lands the real gate.
   */
  networkGate?: NetworkGatePort;
  /**
   * signed config port. Wired by mobile + desktop
   * `createServicePorts.ts` via `createSignedConfigPort` from
   * `@prl-wallet/api-client`. OPTIONAL in because no consumer
   * code reads from it yet (`useSignedConfig` ships the surface
   * but is registered-but-unused); becomes a required hard dep when
   * .1's chain-config cutover replaces ~30+ BLOCKCHAINS callers
   * with `useSignedConfig("chain-config")`. Test factories that don't
   * exercise signed-config can leave the field undefined.
   */
  signedConfig?: SignedConfigPort;
  /**
   * fee oracle port. Wired by mobile + desktop
   * `createServicePorts.ts` via `createFeeOraclePort` from
   * `@prl-wallet/api-client`. OPTIONAL because test factories that
   * don't exercise fee/price can leave the field undefined.
   * Production wiring (mobile always; desktop when deps.storage is
   * defined per ) ALWAYS sets the port.
   */
  feeOracle?: FeeOraclePort;
  /**
   * price feed port. Same optional contract as
   * feeOracle. Wired by mobile + desktop `createServicePorts.ts` via
   * `createPriceFeedPort` from `@prl-wallet/api-client`. OPTIONAL for
   * test factories; production wiring sets it.
   */
  priceFeed?: PriceFeedPort;
  /**
   * push service port. Wired ONLY by mobile
   * `createServicePorts.ts` (push out of scope on desktop).
   * Consumed by NotificationsScreen + <PushListenersSetup /> via
   * `useAdapters().services.push.{registerPush,unregisterPush,getPushPrefs}`.
   * OPTIONAL because desktop never sets it; test factories likewise.
   */
  push?: PushServicePort;
  /**
   * opt-in analytics port. Wired by mobile + desktop
   * `createServicePorts.ts` (full feature parity per UI-SPEC §10, unlike
   * push which is mobile-only). Consumed by AnalyticsScreen (mobile) +
   * Privacy & analytics card (desktop) via
   * `useAdapters().services.analytics.{track,trackFlow,grantConsent,
   * revokeConsent,getConsent}`. OPTIONAL on the type so test factories
   * that don't exercise analytics can leave it undefined; production
   * wiring ALWAYS supplies it.
   */
  analytics?: AnalyticsPort;
  /**
   * Unified release-update mechanism — wired by mobile + desktop
   * `createServicePorts.ts` against `BackendApiClient.getReleasesSince`.
   * Consumed by the UpdateBanner via `useUpdateBanner`'s `getChangelog`
   * callback. OPTIONAL so test factories that don't exercise the update
   * panel can leave it undefined.
   */
  releases?: ReleasesPort;
}

export * from "./blockbook.js";
export * from "./registry.js";
export * from "./runtime.js";
export * from "./storage.js";
// signed config port surface (consumed by useSignedConfig + adapter).
export * from "./signedConfig.js";
// fee oracle + price feed port surfaces (consumed by
// createFeeOraclePort + createPriceFeedPort adapters in api-client; Plan
// 04 wires the optional ServicesPorts fields).
export * from "./feeOracle.js";
export * from "./priceFeed.js";
// push service port surface (consumed by
// NotificationsScreen + PushListenersSetup via useAdapters).
export * from "./push.js";
// opt-in analytics port surface (type-only re-export
// from @prl-wallet/analytics; consumed by AnalyticsScreen + Privacy &
// analytics card via useAdapters).
export * from "./analytics.js";
// Unified release-update mechanism — releases port surface (consumed by
// useUpdateBanner's getChangelog callback).
export * from "./releases.js";
