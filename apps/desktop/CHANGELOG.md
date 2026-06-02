# Changelog

All notable changes to Pearl Keeper Desktop are documented here.
Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)

## [1.3.0] — 2026-05-03

### Added

- Pearl Keeper Desktop for macOS, Windows, and Linux — a native Taproot wallet that mirrors the mobile app's signing behavior byte-for-byte
- Create a new wallet with a freshly-generated BIP39 mnemonic and a guided seed-verification step
- Import an existing wallet via 12- or 24-word mnemonic, BIP32 seed, or extended public key (xpub) for watch-only access
- Multi-wallet home with per-wallet name, network badge, and cached balance — switch between wallets with one click
- Wallet detail view with live balance and transaction history
- Receive screen with a desktop-scaled QR code, full address display, and copy-to-clipboard with checkmark confirmation
- Multi-step Send wizard (address → amount → fee → review → broadcast); signing works fully offline, broadcast requires the network gate to be open
- Persistent network toggle (online/offline) defaulting to offline on first launch — your wallet stays air-gapped until you choose otherwise
- Sensitive-operation warnings before signing, broadcasting, or revealing secrets while online
- Hold-to-reveal seed phrase: hidden by default, only revealed after re-entering your PIN and a type-to-confirm step; auto-clears on window blur or auto-lock
- PIN gate on every launch and re-open, with the ability to change your PIN from Settings
- Configurable auto-lock after idle timeout (default 15 minutes, "Never" option for trusted environments)
- Native menu bar (File / Wallet / View / Help) with OS-standard keyboard shortcuts (Cmd+N, Cmd+W, Cmd+Q on macOS; Ctrl-equivalents on Windows and Linux)
- Responsive master/detail layout that activates at 900px wide and gracefully collapses to single-column on narrower windows
- Window position and size persist across launches; OS dark-mode is followed automatically

### Changed

- Version 1.3.0 (first public desktop release)
- Product name canonicalized to "Pearl Keeper" across all platform artifacts

### Security

- Packaged build verified: zero listening debug ports on each OS (PKG-05, inline CI probe)
- macOS: notarized Developer ID-signed `.dmg` (passes `spctl --assess`)
- Windows: EV-signed `.msi` via Azure Artifact Signing (passes `signtool verify /pa`)
- Linux: `.AppImage` with OS Secret Service backing (macOS Keychain, Windows Credential Manager, Linux Secret Service via `keyring` crate)
- Per-wallet dedicated keychain entries — secrets are never written to disk as a JSON blob, and the app refuses to start on Linux systems without a Secret Service rather than silently falling back to plaintext
- Atomic metadata writes survive power loss with old-or-new semantics
- Four-layer offline enforcement (Tauri capability scopes, Rust HTTP gate, Blockbook client gate, TanStack Query gate) plus a strict CSP and a build-time ESLint ban on raw `window.fetch` and `XMLHttpRequest`
- Send is refused for watch-only wallets; deletion requires a two-step confirmation and wipes only the deleted wallet's keychain entries
