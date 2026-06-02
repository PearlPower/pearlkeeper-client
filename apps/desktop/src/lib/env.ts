// apps/desktop/src/lib/env.ts
// typed accessor for the backend base URL.
//
// Sourced from import.meta.env.VITE_BACKEND_BASE_URL (Vite-injected at
// build time). The build pipeline must inject this from the private
// blockchains.json before bundling. Throws at module load if unset
// (no production URL fallback in source).
//
// Vite envPrefix is locked to ['VITE_'] ( / GHSA-2rcp-jvr4-r259).
// Adding any TAURI_* or other prefix would need a vite.config edit + a
// CI grep update — out of scope for .

function readEnv(): string {
  const fromEnv = (import.meta.env as Record<string, string | undefined>)
    .VITE_BACKEND_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  throw new Error(
    "VITE_BACKEND_BASE_URL is not set. The build pipeline must inject this " +
      "env var before bundling. See packages/config/src/blockchains.example.json " +
      "for the schema.",
  );
}

export const VITE_BACKEND_BASE_URL = readEnv();
