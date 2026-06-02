/* eslint-env node */
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@prl-wallet/eslint-config"],
  rules: {
    // Refactor Change 2 — frontend apps consume hooks/copy/createAnalytics
    // exclusively via @prl-wallet/api-client. Importing
    // @prl-wallet/blockbook or @prl-wallet/analytics directly from mobile
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
    // backend; store-link/explorer URLs handed to the OS via Linking.openURL
    // are exempt (see overrides below).
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/blockbook[.-]/i]",
        message:
          "Blockbook URL composition is backend-only post- (). All client traffic goes through BackendApiClient.",
      },
      {
        selector: "Literal[value=/^https?:\\/\\//]",
        message:
          "Hardcoded http(s) URL — clients can only call the backend (www.pearlkeeper.com). If this is a user-click deep-link (e.g., store URL), add the file to the no-restricted-syntax override in .eslintrc.js with a comment explaining the deep-link rationale.",
      },
      {
        selector: "TemplateElement[value.raw=/^https?:\\/\\//]",
        message:
          "Hardcoded http(s) URL — clients can only call the backend (www.pearlkeeper.com). If this is a user-click deep-link (e.g., store URL), add the file to the no-restricted-syntax override in .eslintrc.js with a comment explaining the deep-link rationale.",
      },
    ],
  },
  overrides: [
    {
      // Test files exercise legacy BlockbookClient mocks; the rule is
      // meaningful for production code paths only.
      files: [
        "src/**/__tests__/**/*.{ts,tsx}",
        "src/__tests__/**/*.{ts,tsx}",
        "src/__mocks__/**/*.{ts,tsx}",
        "src/**/__mocks__/**/*.{ts,tsx}",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
      ],
      rules: {
        "no-restricted-imports": "off",
        "no-restricted-syntax": "off",
      },
    },
    // Refactor Change 2 — services/blockbookClient.ts now imports from
    // @prl-wallet/api-client; services/discoverAddresses.ts imports
    // BlockbookClientLike from api-client. No remaining override needed.
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
