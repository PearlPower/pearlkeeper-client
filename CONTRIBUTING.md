# Contributing to Pearl Keeper

## External contributions are not currently accepted

This repository is published as **source-available** under the
[PolyForm Strict License 1.0.0](LICENSE) for the purpose of public
inspection and verification of the Pearl Keeper client software.

We are **not currently accepting external code contributions** (pull
requests, patches, or derivative works). This is a deliberate choice
during the early development phase — we will reconsider the contribution
model in a future release.

## What you can do

### Report bugs

If you find a bug, please [open an issue](https://github.com/PearlPower/pearlkeeper-client/issues/new?template=bug-report.md).
Include:

- Platform (iOS / Android / macOS / Windows / Linux) and version
- Wallet version (Settings → About)
- Steps to reproduce
- Expected vs. actual behavior

### Suggest features

[Open a feature request issue](https://github.com/PearlPower/pearlkeeper-client/issues/new?template=feature-request.md).
We read every suggestion, but cannot promise a response timeline.

### Report security vulnerabilities

**Do not** file security issues as public GitHub Issues. Follow the
disclosure flow in [SECURITY.md](SECURITY.md).

### Verify the source

You are encouraged to:

- Read the source to confirm the wallet does what we claim.
- Build from source (`npm ci && npm run build`) and compare against the
  signed release binaries — see [release verification](README.md#verifying-releases).
- Audit the cryptographic surface in `packages/core/`, the network gate
  in `apps/{desktop,mobile}/src/services/`, and the analytics schema in
  `packages/analytics/`.

These activities are explicitly permitted as personal/noncommercial use
under the PolyForm Strict 1.0.0 license.

## Licensing inquiries

If you would like to:

- Use the source for commercial purposes
- Modify the source for internal use at your organization
- Distribute a fork or derivative work
- Embed Pearl Keeper code in another product

contact PearlPower to discuss a separate license. The PolyForm Strict
1.0.0 license that ships with this repository does **not** grant any of
the above rights.

## Trademark

The names "Pearl Keeper" and "PearlPower," and the associated logos and
visual identity, are not licensed and remain the property of PearlPower.
Any fork or derivative work permitted under a separately-granted license
must use a distinct name and visual identity.

## Future contribution model

We may revisit the contribution model in a future release (e.g., adopting
a CLA, switching to a permissive license for select packages, or
publishing a contribution policy). Watch the repository for updates.
