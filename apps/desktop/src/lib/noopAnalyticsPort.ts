// apps/desktop/src/lib/noopAnalyticsPort.ts
//
// defensive no-op analytics port for screens that
// instrument flows via useAnalyticsFlow. Mirrors apps/mobile/src/lib/
// noopAnalyticsPort.ts () so the desktop + mobile call sites use
// the same defensive idiom: `services.analytics ?? NOOP_ANALYTICS_PORT`.
//
// useAnalyticsFlow requires a non-null AnalyticsPort and reads
// `port.getConsent()` inside every callback to decide whether to emit.
// In production wiring (createServicePorts.ts) the port is always
// supplied. The desktop test harness (TestHarness.tsx + factories.ts)
// also wires the real port through the AdaptersBundle, so this stub is
// rarely exercised — it exists as belt-and-suspenders defense for any
// future test factory that constructs a partial bundle without an
// analytics port. The stub reports `granted: false` so every callback
// short-circuits at the consent check (CONTEXT layer #2).

import type { AnalyticsPort } from "@prl-wallet/api-client";

export const NOOP_ANALYTICS_PORT: AnalyticsPort = {
  track: () => {},
  trackFlow: () => {},
  grantConsent: async () => {},
  revokeConsent: async () => {},
  getConsent: () => ({ granted: false, decidedAt: null }),
};
