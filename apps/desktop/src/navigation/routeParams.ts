// apps/desktop/src/navigation/routeParams.ts
//
// Desktop-local route param map (not shared in packages/).
// expansion: every route from .

export type RouteParamMap = {
  "/": undefined;
  "/__parity": undefined; // dev-only — registered conditionally on import.meta.env.DEV

  // Auth / PIN
  "/pin/create": undefined;
  "/pin/confirm": undefined;
  "/pin/unlock": undefined;

  // Wallet list + detail
  "/wallets": undefined;
  "/wallet/:id": { id: string };

  // Create wizard
  "/wallet/new": undefined;
  "/wallet/new/seed": undefined;
  "/wallet/new/verify": undefined;
  "/wallet/new/name": undefined;
  "/wallet/new/done": undefined;

  // Import wizard
  "/wallet/import": undefined;
  "/wallet/import/mnemonic": undefined;
  "/wallet/import/bip32": undefined;
  "/wallet/import/xpub": undefined;
  "/wallet/import/name": undefined;
  "/wallet/import/done": undefined;

  // Settings
  "/settings": undefined;
  "/settings/change-pin": undefined;

  // Receive + Send wizard routes (TX-01, TX-04)
  "/wallet/:id/receive": { id: string };
  "/wallet/:id/send": { id: string };
  "/wallet/:id/send/address": { id: string };
  "/wallet/:id/send/amount": { id: string };
  "/wallet/:id/send/fee": { id: string };
  "/wallet/:id/send/review": { id: string };
  "/wallet/:id/send/success": { id: string };
};
