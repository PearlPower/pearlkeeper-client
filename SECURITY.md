# Security policy

## Reporting a vulnerability

Please email `security@pearlkeeper.com` with a clear description, repro
steps, and any proof-of-concept code. **Do not** open a public GitHub Issue
for security reports.

PGP encryption: a public PGP key is available on request — email us first
and we will reply with the current fingerprint.

## Supported versions

Only the latest minor version of PRL Wallet receives security patches.

| Version  | Supported          |
| -------- | ------------------ |
| v1.4.x   | :white_check_mark: |
| v1.3.x   | :x:                |
| < v1.3.0 | :x:                |

## In scope

- Client-side cryptography (BIP86 derivation, Schnorr signing, PSBT build)
- Key handling and OS-keychain / SecureStore integration
- PIN authentication flows and lock state
- Address derivation and verification logic
- Send-flow signing and broadcast verification
- The `@prl-wallet/eslint-plugin-analytics` rule (a bypass would let
  analytics events carry on-chain identifiers)

## Out of scope

- The PRL backend (closed source — please report backend issues directly
  to the same email; we'll handle them privately)
- Bugs in third-party dependencies — please report those upstream and CC
  this email so we can coordinate.

## Response SLA

We aim to acknowledge new reports within **72 hours**. We do not promise a
fix-time guarantee — complexity, severity, and our team's availability
affect timeline. We will keep you informed.

## Disclosure timeline

We follow coordinated disclosure with a default 90-day window from
acknowledgment. We may extend the window for unusually complex fixes; we
will not silently miss the deadline.

## Communications

All vulnerability communication happens via the email above. Once a fix
ships in a public release, we publish a brief advisory in the release notes
and (for higher-severity issues) a GitHub Security Advisory.

## Hall of fame

We do not currently run a bug bounty. Public credit in advisories is
available on request.
