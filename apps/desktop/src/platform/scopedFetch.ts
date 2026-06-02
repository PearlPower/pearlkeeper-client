// apps/desktop/src/platform/scopedFetch.ts
//
// ( + ) + () — desktop's typeof-fetch wrapper
// around @tauri-apps/plugin-http's fetch. This is the ONLY file in
// apps/desktop/src/** allowed to import a network primitive name.
//
// rename: previously named after the Blockbook host. Post-cutover
// the wrapper is no longer Blockbook-specific — it's a generic scoped-fetch
// over the Tauri capability scope (which now allows the configured backend
// host and dev localhost only — see capabilities/default.json).
//
// The eslint override on this file is configured in
// apps/desktop/.eslintrc.cjs ( / ).
//
// All HTTP from the WebView routes through Rust via plugin-http, so
// the Rust state-mutex () and capability scope (
// ) can both gate every request before a socket opens. The
// BackendApiClient ( / ) accepts this wrapper as its
// `fetchImpl` constructor arg.

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export const scopedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input as Request).url;
  try {
    const res = await tauriFetch(input as RequestInfo, init);
    const body = await res.clone().text();
    console.log("[scopedFetch]", init?.method ?? "GET", url, res.status, body.slice(0, 500));
    return res;
  } catch (e) {
    console.log("[scopedFetch] THREW", init?.method ?? "GET", url, e);
    throw e;
  }
};
