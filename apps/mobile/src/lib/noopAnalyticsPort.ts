// apps/mobile/src/lib/noopAnalyticsPort.ts
//
// defensive no-op analytics port for screens that
// instrument flows via useAnalyticsFlow.
//
// useAnalyticsFlow requires a non-null AnalyticsPort and reads
// `port.getConsent()` inside every callback to decide whether to emit.
// In production wiring (createServicePorts.ts) the port is always
// supplied, but the hook also runs at test time where the adapters
// context may be stubbed without an analytics field. This stub lets
// every callback short-circuit safely without flipping the call site
// into a conditional hook.
//
// Defense-in-depth alignment: the stub reports `granted: false` so
// every useAnalyticsFlow callback returns early at the consent check
// (CONTEXT layer #2). No-op `track`/`trackFlow` round out the
// interface for any direct call sites that might reach this stub.

import type { AnalyticsPort } from "@prl-wallet/api-client";

export const NOOP_ANALYTICS_PORT: AnalyticsPort = {
  track: () => {},
  trackFlow: () => {},
  grantConsent: async () => {},
  revokeConsent: async () => {},
  getConsent: () => ({ granted: false, decidedAt: null }),
};
