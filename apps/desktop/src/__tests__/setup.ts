// LOAD-BEARING ORDER: import the Buffer polyfill FIRST so its module-init
// assignment runs before any subsequent import pulls in bitcoinjs-lib /
// ecpair (e.g. via @prl-wallet/services or @prl-wallet/app-flows). ECC
// validation at those modules' init time relies on the fixed Buffer.
import "./bufferPolyfill";

import "@testing-library/jest-dom/vitest";
// jsdom@29 ships globalThis.crypto.getRandomValues by default — no manual polyfill needed.

// env.ts now throws if VITE_BACKEND_BASE_URL is unset (no production
// URL fallback in source). Tests must inject a stub value before any module that
// imports env.ts loads. import.meta.env values must be set via vi.stubEnv (or
// similar) before the test imports the module under test. We set a stub here
// at top-level so it is in place before any test file runs.
import { vi } from "vitest";
vi.stubEnv("VITE_BACKEND_BASE_URL", "https://test.example.com");

// Production `BLOCKCHAINS` (built from blockchains.json) filters out chains
// and networks with `enabled: false` — currently `bitcoin` (chain) and
// `prl-testnet` (network). Many desktop screen tests hardcode `btc-mainnet` /
// `btc-testnet` (and helpers like explorerUrl.ts snapshot BLOCKCHAINS into a
// Map at module-init time), so we splice the test fixture into the exported
// `BLOCKCHAINS` array in place — that mutates the same reference every
// consumer (config users, resolveNetworkContext's activeBlockchains seam,
// getNetworkMetadata's activeBlockchains seam, init-time map snapshots) holds.
// Imports below transitively load bitcoinjs-lib — hence bufferPolyfill comes first.
import type { BlockchainConfig } from "@prl-wallet/config";
import { BLOCKCHAINS } from "@prl-wallet/config";
import testBlockchains from "@prl-wallet/config/blockchains.test.json";

BLOCKCHAINS.splice(
  0,
  BLOCKCHAINS.length,
  ...(testBlockchains.blockchains as unknown as BlockchainConfig[]),
);

// ResizeObserver polyfill — required by Radix UI primitives (Switch, Dialog, etc.)
// that use @radix-ui/react-use-size internally. jsdom does not implement
// ResizeObserver, so any component that triggers useSize will throw
// "ResizeObserver is not defined" without this stub.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// scrollIntoView polyfill — ( ) introduced
// the first Radix <Select> consumer (Auto-lock dropdown in SettingsScreen).
// Radix Select's selected-item-aligned positioning calls
// candidate.scrollIntoView() inside an effect; jsdom does not implement
// HTMLElement.prototype.scrollIntoView, throwing "candidate?.scrollIntoView
// is not a function". The stub is a no-op — Select option-pick behavior
// (onValueChange) is unaffected; only the optional auto-scroll-to-selected
// UX is suppressed in jsdom, which is the desired test outcome.
if (
  typeof Element !== "undefined" &&
  typeof (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView !==
    "function"
) {
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView =
    function () {};
}

// hasPointerCapture / releasePointerCapture polyfills — also needed by
// Radix Select in jsdom; the trigger button's onPointerDown handler calls
// these on the event.target. Without the stubs, opening the Select via
// fireEvent.click → onPointerDown throws.
if (
  typeof Element !== "undefined" &&
  typeof (Element.prototype as { hasPointerCapture?: unknown }).hasPointerCapture !==
    "function"
) {
  (Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture =
    function () {
      return false;
    };
}
if (
  typeof Element !== "undefined" &&
  typeof (Element.prototype as { releasePointerCapture?: unknown }).releasePointerCapture !==
    "function"
) {
  (Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture =
    function () {};
}

// matchMedia polyfill — required by next-themes () when
// `enableSystem` is on. next-themes calls window.matchMedia('(prefers-color-scheme: dark)')
// on mount; jsdom 29 does not implement matchMedia. The stub returns a
// MediaQueryList-shaped object so the constructor succeeds; jsdom does not
// reliably simulate prefers-color-scheme change events anyway, so the
// dynamic OS-theme-flip case is exercised in Manual UAT (per
// ), not unit
// tests.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // legacy
      removeListener: () => {}, // legacy
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom 29 does not implement Blob.prototype.arrayBuffer; ReceiveScreen's
// Save-as-PNG flow needs it to convert the canvas blob into bytes for
// Tauri's writeFile. Stub it here for any test that creates a Blob.
if (typeof (Blob.prototype as { arrayBuffer?: unknown }).arrayBuffer !== "function") {
  (Blob.prototype as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer =
    function (this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
}
