// packages/services/src/ports/push.ts
// / — push service port surface.
//
// Exposes the three BackendApiClient push methods on `ServicesPorts.push`
// so the mobile <PushListenersSetup /> ( token-rotation listener) and
// <NotificationsScreen /> (.. settings UI) can invoke them via
// `useAdapters().services.push` without piercing the BackendApiClient
// construction abstraction.
//
// Optional on `ServicesPorts` so:
// desktop createServicePorts.ts (push out of scope) can omit it,
// test factories that don't exercise push flows can leave it undefined.
//
// Production wiring on the mobile adapters/createServicePorts module ALWAYS
// sets the field via the apiClient factory. (Path elided to keep this file
// independent of any consuming application — see ports-contracts.test.ts
// orchestration-independence assertion.)
//
// Type re-exports from @prl-wallet/api-schemas keep this port file light;
// the schemas are the single source of truth for wire shape.

import type {
  PushRegisterRequest,
  PushRegisterMeResponse,
} from "@prl-wallet/api-schemas";

export interface PushServicePort {
  /** — UPSERT current instance's push registration (token + subs + prefs). */
  registerPush(req: PushRegisterRequest): Promise<{ ok: true }>;
  /** — idempotent revoke (DELETE /api/v1/push/register). */
  unregisterPush(): Promise<{ ok: true }>;
  /** — server-authoritative read of current registration state + prefs. */
  getPushPrefs(): Promise<PushRegisterMeResponse>;
}
