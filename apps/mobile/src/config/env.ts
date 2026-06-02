// apps/mobile/src/config/env.ts
// typed accessor for the backend base URL.
//
// Sourced from process.env.EXPO_PUBLIC_BACKEND_BASE_URL (Expo bundler-
// injected at build time — gitignored .env / .env.development feeds this).
// The build pipeline must inject this from the private blockchains.json
// before bundling. Throws at module load if unset (no
// production URL fallback in source).
//
// Pitfall C-NEW-05: Android emulator devs must override to http://10.0.2.2:8787
// (host's localhost). iOS simulator can use http://localhost:8787 or 127.0.0.1.

function readEnv(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;
  throw new Error(
    "EXPO_PUBLIC_BACKEND_BASE_URL is not set. The build pipeline must inject " +
      "this env var before bundling. See packages/config/src/blockchains.example.json " +
      "for the schema.",
  );
}

export const EXPO_PUBLIC_BACKEND_BASE_URL = readEnv();
