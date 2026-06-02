# Pearl Keeper

> Self-custodial wallet for the Pearl (PRL) network — iOS, Android, macOS, Windows, and Linux.

[![CI](https://github.com/PearlPower/pearlkeeper-client/actions/workflows/ci.yml/badge.svg)](https://github.com/PearlPower/pearlkeeper-client/actions/workflows/ci.yml)
[![Source Available](https://img.shields.io/badge/source--available-PolyForm%20Strict%201.0-blue)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/PearlPower/pearlkeeper-client)](https://github.com/PearlPower/pearlkeeper-client/releases/latest)

> **This repository is source-available under the PolyForm Strict License 1.0.0.**
>
> Some internal packages are not included and are required to build or run
> the full application. Those packages are not designed to receive private
> keys, seed phrases, or other sensitive wallet secrets.
>
> This repository is provided for transparency and review, but it is **not
> a complete reproducible source release**.

## What this is

Pearl Keeper is a self-custodial wallet for the Pearl (PRL) network. Keys
never leave the device — signing happens client-side, the backend only
relays already-signed transactions and serves auxiliary data (fee oracle,
price feed, signed config, anti-abuse counters). The app runs natively on
iOS, Android, macOS, Windows, and Linux from a single shared TypeScript
codebase plus a Rust core for desktop OS-keychain integration.

The wallet is deliberately small in surface: PIN-only auth, no accounts,
no email, no cross-device sync, no third-party tracking. An "honest offline"
network gate ensures that toggling the app offline blocks every outbound
request — verifiable in this repository's source.

## Supported platforms

| Platform | Minimum OS                  | Architectures                     | Distribution                     |
| -------- | --------------------------- | --------------------------------- | -------------------------------- |
| iOS      | iOS 16+                     | arm64                             | App Store                        |
| Android  | Android 11+ (API 30+)       | arm64-v8a, armeabi-v7a            | Google Play / `.apk` sideload    |
| macOS    | macOS 12 Monterey+          | Universal (Intel + Apple Silicon) | `.dmg` from GitHub Releases      |
| Windows  | Windows 10 1809+            | x86_64                            | `.msi` from GitHub Releases      |
| Linux    | glibc 2.35+ (Ubuntu 22.04+) | x86_64                            | `.AppImage` from GitHub Releases |

## Architecture

```
              ┌──────────────────────────────────────┐
              │         Pearl Keeper client          │
              │  ┌────────────┐    ┌──────────────┐  │
              │  │ apps/mobile│    │ apps/desktop │  │
              │  │ (Expo SDK) │    │ (Tauri 2.10) │  │
              │  └─────┬──────┘    └──────┬───────┘  │
              │        └─────┬────────────┘          │
              │              │ shared TS packages    │
              │              │ (services, app-flows, │
              │              │  app-state, ports)    │
              └──────────────┼───────────────────────┘
                             │
                             ▼ HTTPS (single backend host)
                   ┌────────────────────┐
                   │ Pearl backend (closed)│
                   │ • indexer proxy    │
                   │ • broadcast relay  │
                   │ • signed config    │
                   │ • fee + price feed │
                   │ • push notifier    │
                   └────────┬───────────┘
                            │
                            ▼
                   Blockbook + PRL nodes
```

Keys, address derivation, transaction construction, PSBT signing, and
broadcast-result verification all run client-side. The backend is closed
source and treated as untrusted: every backend response is either
non-critical (price feed, fee tier hint) or independently verifiable by
the client (UTXO scriptPubKey is re-derived from the local xpub, broadcast
txid is recomputed locally, signed-config envelopes are Ed25519-verified
against baked public keys with monotonic replay defense).

## Building from source

Building from source is **not supported in this repository**. Several
internal packages required for a complete build are not distributed here
(see the disclaimer at the top of this file). The published GitHub Releases
are the canonical distribution.

If you wish to verify the released binaries, see [Verifying releases](#verifying-releases)
below.

## Verifying releases

Every GitHub release attaches `.dmg` / `.msi` / `.AppImage` / `.apk` binaries
plus `SHA256SUMS` (POSIX `shasum -a 256` output) and `SHA256SUMS.sig`
(an Ed25519 minisign signature). The minisign public key is committed to
this repository at `prl-wallet-pubkey.pub`.

To verify a release on macOS or Linux:

```bash
curl -LO https://github.com/PearlPower/pearlkeeper-client/releases/download/v1.4.0/SHA256SUMS
curl -LO https://github.com/PearlPower/pearlkeeper-client/releases/download/v1.4.0/SHA256SUMS.sig
curl -LO https://raw.githubusercontent.com/PearlPower/pearlkeeper-client/main/prl-wallet-pubkey.pub

minisign -V -p prl-wallet-pubkey.pub -m SHA256SUMS -x SHA256SUMS.sig
# Expected output:
#   Signature and comment signature verified
#   Trusted comment: Pearl Keeper v1.4.0 release

shasum -a 256 -c SHA256SUMS --ignore-missing
# Expected output:
#   Pearl Keeper_1.4.0_universal.dmg: OK
#   PearlKeeper_1.4.0.apk: OK
#   ...
```

Install minisign via `brew install minisign` (macOS), `apt install minisign`
(Debian/Ubuntu), or `cargo install rsign2` (any platform with Rust).

## Privacy & telemetry

Analytics is **off by default**. Nothing is collected unless you explicitly
opt in via the in-app prompt (Settings → Privacy & analytics). When enabled,
the wallet emits a fixed schema — event name, timestamp, platform, app
version, flow ID, step ID, success/failure, and step duration. A custom
ESLint rule enforces that no address-, txid-, or amount-shaped value can
enter an analytics property at the source. You can revoke consent at any
time; the locally queued events are deleted immediately, and the backend
aggregates events without retaining per-instance raw streams. See the
`packages/analytics/` source for the full schema.

## Contributing

External code contributions are not currently accepted. The source is
published for inspection and verification purposes. To report a bug or
suggest a change, please [open an issue](https://github.com/PearlPower/pearlkeeper-client/issues).
For licensing inquiries, contact PearlPower. See [CONTRIBUTING.md](CONTRIBUTING.md)
for details.

## Security

Security issues should NOT be filed as public GitHub Issues. See
[SECURITY.md](SECURITY.md) for the disclosure flow, supported versions, and
response SLA.

## License

This source is published for **inspection and verification only** under the
[PolyForm Strict License 1.0.0](https://polyformproject.org/licenses/strict/1.0.0/).

Copyright (c) 2026 PearlPower. All rights reserved.

Under PolyForm Strict 1.0.0:

- ✓ You may **read** the source for inspection and verification.
- ✗ You may **not** distribute, fork, modify, or create derivative works
  without explicit written permission from PearlPower.
- ✗ You may **not** use the software for any commercial purpose without
  explicit written permission from PearlPower.

Note: this repository is not a complete source release — building or
running the full application requires internal packages that are not
included here.

The names "Pearl Keeper" and "PearlPower," and the associated logos and
visual identity, are not licensed under PolyForm Strict 1.0.0 and remain
the property of PearlPower. Any fork or derivative work permitted under a
separately-granted license must use a distinct name and identity.

For licensing inquiries (commercial use, redistribution, derivative
works), contact PearlPower.
