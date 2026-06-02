const chainIdentityRestrictedSyntax = require("@prl-wallet/eslint-config/chain-identity");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@prl-wallet/eslint-config"],
  parserOptions: {
    project: ["./tsconfig.json", "./tsconfig.node.json"],
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
  },
  rules: {
    "no-restricted-globals": [
      "error",
      {
        name: "fetch",
        message: "Use @tauri-apps/plugin-http; browser networking primitives are banned in apps/desktop. All HTTP must route through Rust.",
      },
      {
        name: "XMLHttpRequest",
        message: "Use @tauri-apps/plugin-http; browser networking primitives are banned in apps/desktop. All HTTP must route through Rust.",
      },
      {
        name: "WebSocket",
        message: "Use @tauri-apps/plugin-http; browser networking primitives are banned in apps/desktop. All HTTP must route through Rust.",
      },
      {
        name: "EventSource",
        message: "Use @tauri-apps/plugin-http; browser networking primitives are banned in apps/desktop. All HTTP must route through Rust.",
      },
    ],
    "no-restricted-properties": [
      "error",
      {
        object: "navigator",
        property: "sendBeacon",
        message: "Use @tauri-apps/plugin-http; browser networking primitives are banned in apps/desktop. All HTTP must route through Rust.",
      },
    ],
    // Refactor Change 2 — frontend apps consume hooks/copy/createAnalytics
    // exclusively via @prl-wallet/api-client. Importing
    // @prl-wallet/blockbook or @prl-wallet/analytics directly from desktop
    // src is banned outright; api-client is the boundary that internally
    // uses both packages. The / BlockbookClient ban
    // remains a no-op subset of this stricter rule.
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@prl-wallet/blockbook",
            message:
              "Frontend imports the @prl-wallet/blockbook surface via @prl-wallet/api-client (refactor Change 2). The blockbook package itself is backend-side: schemas, types, upstream HTTP fetcher.",
          },
          {
            name: "@prl-wallet/analytics",
            message:
              "Frontend imports the @prl-wallet/analytics surface via @prl-wallet/api-client (refactor Change 2). The analytics package itself stays for AnalyticsPort + wire-shape types — both re-exported from @prl-wallet/api-client.",
          },
        ],
      },
    ],
    // ban Blockbook URL composition strings in app code.
    // follow-up — ban any hardcoded http(s) URL outside the
    // documented deep-link allowlist. Clients can only make API calls to the
    // backend; explorer/mempool links handed to the OS browser are exempt
    // (see overrides below).
    "no-restricted-syntax": [
      "error",
      // Shared "no chain identity leaks" rules — flag hardcoded network-id
      // fallbacks (`?? "btc-mainnet"`) and asset-symbol casts
      // (`as "BTC" | "PRL"`). Defined in @prl-wallet/eslint-config and
      // spread here because ESLint v8 replaces rule configs across
      // `extends`.
      ...chainIdentityRestrictedSyntax,
      {
        selector: "Literal[value=/blockbook[.-]/i]",
        message:
          "Blockbook URL composition is backend-only post- (). All client traffic goes through BackendApiClient.",
      },
      {
        selector: "Literal[value=/^https?:\\/\\//]",
        message:
          "Hardcoded http(s) URL — clients can only call the backend (www.pearlkeeper.com). If this is a user-click deep-link (e.g., explorer), add the file to the no-restricted-syntax override in .eslintrc.cjs with a comment explaining the deep-link rationale.",
      },
      {
        selector: "TemplateElement[value.raw=/^https?:\\/\\//]",
        message:
          "Hardcoded http(s) URL — clients can only call the backend (www.pearlkeeper.com). If this is a user-click deep-link (e.g., explorer), add the file to the no-restricted-syntax override in .eslintrc.cjs with a comment explaining the deep-link rationale.",
      },
    ],
  },
  overrides: [
    {
      // Pre-Plan-04 file allowed to use the `fetch` identifier and import
      // @tauri-apps/plugin-http. renames this to scopedFetch.ts.
      files: ["src/platform/blockbookFetch.ts"],
      rules: {
        "no-restricted-globals": "off",
      },
    },
    {
      // Post-Plan-04 file (renamed). Pitfall C-NEW-09 — registered now so the
      // rename in doesn't require re-touching this config. Until the
      // file exists, this override is a no-op.
      files: ["src/platform/scopedFetch.ts"],
      rules: {
        "no-restricted-globals": "off",
      },
    },
    // Refactor Change 2 — getBlockbookClient + createServicePorts now
    // import from @prl-wallet/api-client (no remaining blockbook/analytics
    // direct imports in src), so the legacy override is no longer needed.
    {
      // Test files use vi.spyOn(globalThis, 'fetch') and friends; the rule
      // is meaningful only for production code paths.
      files: [
        "src/**/__tests__/**/*.{ts,tsx}",
        "src/__tests__/**/*.{ts,tsx}",
        "src/**/__mocks__/**/*.{ts,tsx}",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
      ],
      rules: {
        "no-restricted-globals": "off",
        "no-restricted-properties": "off",
        "no-restricted-imports": "off",
        "no-restricted-syntax": "off",
      },
    },
    {
      // User-click deep links (explorer URLs handed to the OS browser via
      // openUrl plugin). The wallet process never issues HTTP to these
      // hosts — the URL leaves the app boundary. Documented at the top of
      // explorerUrl.ts.
      files: [
        "src/lib/explorerUrl.ts",
        "src/screens/Send/SendSuccessScreen.tsx",
      ],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "Literal[value=/blockbook[.-]/i]",
            message:
              "Blockbook URL composition is backend-only post- ().",
          },
        ],
      },
    },
    {
      // test/__mocks__/spec files may include
      // sensitive-shaped strings to verify the analytics/no-sensitive-properties
      // rule itself (e.g., a future analytics-screen test). The shared
      // @prl-wallet/eslint-config already disables this rule for these
      // scopes; the per-app override re-affirms the contract authoritatively.
      files: [
        "src/**/__tests__/**/*.{ts,tsx}",
        "src/__tests__/**/*.{ts,tsx}",
        "src/**/__mocks__/**/*.{ts,tsx}",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
      ],
      rules: {
        "analytics/no-sensitive-properties": "off",
      },
    },
  ],
};
