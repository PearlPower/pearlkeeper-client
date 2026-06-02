// packages/services/src/ports/analytics.ts — + .
//
// Type-only re-export of AnalyticsPort (and friends) from the
// @prl-wallet/analytics package. The services layer needs the typed
// surface for `ServicesPorts.analytics` without importing the runtime
// factory — the factory is loaded only by the per-app
// createServicePorts.ts adapter (mobile + desktop). Avoids a runtime
// dependency cycle since @prl-wallet/services should not pull in
// React-coupled hook code.
//
// IMPORTANT (NodeNext): all relative imports MUST end in `.js` even
// though the source files are `.ts`. The `@prl-wallet/analytics` import
// below is a package-boundary import — no `.js` suffix needed.

export type {
  AnalyticsPort,
  AnalyticsConsent,
  TrackFlowStep,
} from "@prl-wallet/analytics";
