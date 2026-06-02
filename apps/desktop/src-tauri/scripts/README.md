# apps/desktop/src-tauri/scripts/

**, , ** — Tooling for the mitmproxy UAT against the post-Phase-28 backend cutover.

This directory contains:

- `mitmproxy-.sh` — Linux-canonical bash runner ().
- `mitmproxy-net07-assert.py` — Python mitmproxy addon for host-allow-list assertion.
- `README.md` — this file.

## Purpose

Verify that the post-Phase-28 desktop binary's HTTPS egress hits ONLY the locked 3-host allow-list:

- `www.pearlkeeper.com` (production backend; )
- `localhost:8787` (dev backend)
- `127.0.0.1:8787` (dev backend, numeric)

If a flow hits any other host (e.g., `*.trezor.io`, `*.blockbook.*`, third-party CDNs), the script fails with a violations list.

This closes the v1.3 deferral against the new cutover surface ( carry-over table).

## Prerequisites

### Linux (canonical environment per )

```bash
sudo apt-get install -y python3-pip ca-certificates curl
pipx install 'mitmproxy>=10.0,<11.0' # version pin — Assumption A6
mitmdump --version # verify
```

### macOS (fallback per — non-canonical)

```bash
brew install mitmproxy
# Pin range cannot be enforced via brew formula; verify version manually:
mitmdump --version # require >=10.0,<11.0
```

### Build the desktop binary BEFORE running the script

The capability scope is bundled at build time (**Pitfall 8** — capability files are loaded at process start; production binaries embed them at build):

```bash
cd apps/desktop && pnpm tauri build
# Or for debug builds:
cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml
```

If you edit `apps/desktop/src-tauri/capabilities/default.json` mid-test, **rebuild before re-running the script**.

## CA trust dance

`mitmdump` generates `~/.mitmproxy/mitmproxy-ca-cert.pem` on first run. The OS must trust this CA for the desktop binary's TLS chain to validate when proxied.

### Linux (auto-handled by `mitmproxy-.sh`)

The script auto-installs the CA on first run via:

```bash
sudo cp ~/.mitmproxy/mitmproxy-ca-cert.pem /usr/local/share/ca-certificates/mitmproxy.crt
sudo update-ca-certificates
```

### macOS (manual — script does NOT auto-execute this)

Trust via Keychain Access or CLI:

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  ~/.mitmproxy/mitmproxy-ca-cert.pem
```

### Windows

```powershell
certutil -addstore -f "ROOT" %USERPROFILE%\.mitmproxy\mitmproxy-ca-cert.cer
```

## Cleanup (security domain — T-29-CA-LEAK mitigation)

After UAT, **untrust the mitmproxy CA**. Leaving a development CA permanently trusted is a real attack surface (a leaked private key would let any party MitM your machine).

### Linux

```bash
sudo update-ca-certificates --remove /usr/local/share/ca-certificates/mitmproxy.crt
sudo rm -f /usr/local/share/ca-certificates/mitmproxy.crt
sudo update-ca-certificates
```

### macOS

```bash
sudo security delete-trusted-cert -d -r trustRoot \
  ~/.mitmproxy/mitmproxy-ca-cert.pem
# Or via Keychain Access GUI: Search "mitmproxy" → delete
```

### Windows

```powershell
certutil -delstore "ROOT" "mitmproxy"
```

## Usage

```bash
# Linux happy path:
bash apps/desktop/src-tauri/scripts/mitmproxy-.sh

# Custom flow-log path:
FLOW_LOG=/tmp/my-mitmproxy.log bash apps/desktop/src-tauri/scripts/mitmproxy-.sh

# Custom desktop binary:
DESKTOP_BIN=/path/to/prl-wallet-desktop bash apps/desktop/src-tauri/scripts/mitmproxy-.sh
```

The script runs two phases:

1. **Phase A — Positive control** — confirms the proxy is intercepting (capture > 0 bytes).
2. **Phase B — Host-allow-list assertion** — runs the python addon over the captured flows; writes `/tmp/net07-violations` (empty = clean).

## Working with capability scope changes (Pitfall 8)

Tauri capability files (`apps/desktop/src-tauri/capabilities/default.json`) are loaded at app boot. Editing them while `tauri dev` is running has NO effect — the new scope is only read at the next process start.

For UAT runs, **always**:

1. Stop any running `tauri dev` / desktop binary.
2. Edit capabilities (if needed).
3. Rebuild: `pnpm tauri build` (production) or `cargo build` (debug).
4. Re-run `mitmproxy-.sh`.

## Relationship to scripts/uat/network-gate-mitmproxy.sh ( legacy)

The original script at `scripts/uat/network-gate-mitmproxy.sh` is **legacy v1.3** — it asserts a different invariant ("zero outbound flows when network gate is OFF") against the pre-cutover Blockbook host set (`*.pearlkeeper.com` + `*.trezor.io`).

's new script at `apps/desktop/src-tauri/scripts/mitmproxy-.sh` asserts the **post-Phase-28 narrowed allow-list** (3 hosts). The legacy script is preserved (do NOT delete) to keep verification re-runnable for milestone-audit purposes.

## References

- lock: ``
- capability narrowing: `` ,
- contract: `` , ,
- Runbook: ``
- Allow-list source: `apps/desktop/src-tauri/capabilities/default.json` ()
- mitmproxy 10.x docs: https://docs.mitmproxy.org/stable/addons-overview/
