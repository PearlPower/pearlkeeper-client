import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // ORDER LOAD-BEARING: nodePolyfills before react. Reverses lead to
    // bitcoinjs-lib@^7 failing to find Buffer at module-evaluation time.
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
      include: ["buffer", "crypto", "process", "stream", "events", "util"],
    }),
    react(),
    tailwindcss(),
  ],
  // / CVE-2023-46115 / GHSA-2rcp-jvr4-r259: only VITE_-prefixed env vars
  // get embedded into the browser bundle. NEVER add TAURI_ here — it would
  // leak TAURI_SIGNING_PRIVATE_KEY and friends. Enforced by .github/workflows/ci.yml grep.
  envPrefix: ['VITE_'],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tauri convention: dev server pinned to 1420, no auto port hop.
  // tauri.conf.json must declare `devUrl: "http://localhost:1420"` to match.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  // Vitest is configured here ( single-config) so test runs reuse the
  // same plugin pipeline as production.
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    // bitcoinjs-lib + ecpair + bip32 ship CommonJS; @bitcoinerlab/secp256k1 ships
    // ESM but must be inlined together with ecpair/bip32 so all three modules
    // share a single ecc object reference (otherwise ECPairFactory's testEcc
    // validation sees mismatched function identities and throws "ecc library invalid").
    // Note: Vitest 4 moved deps.inline → server.deps.inline.
    server: {
      deps: {
        inline: [
          "bitcoinjs-lib",
          "ecpair",
          "bip32",
          "@bitcoinerlab/secp256k1",
          "@noble/curves",
          "@noble/hashes",
        ],
      },
    },
  },
});
