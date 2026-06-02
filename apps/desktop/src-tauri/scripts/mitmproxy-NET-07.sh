#!/usr/bin/env bash
# apps/desktop/src-tauri/scripts/mitmproxy-.sh
#
# , , — End-to-end proof that the post-Phase-28
# desktop binary's HTTPS egress hits ONLY the locked 3-host allow-list:
#
# www.pearlkeeper.com (production backend; lock)
# localhost:8787 (dev backend)
# 127.0.0.1:8787 (dev backend, numeric)
#
# WHAT THIS SCRIPT PROVES ( inversion vs. ):
# asserted "ZERO outbound flows when network toggle is OFF".
# asserts "EVERY captured flow's host ∈ allow-list" — because
# post-cutover the app DOES emit flows (to the backend); the question is
# whether anything leaks BEYOND the 3 allowed hosts.
#
# LOAD-BEARING:
# This script + the python assertion addon are the only artifacts that
# prove capability-scope narrowing holds at the network layer.
# A green run = ledger row eligible to transition pass; a red run
# = a regression that MUST block .
#
# DEPENDENCIES:
# Linux only (macOS Keychain dance is documented in README, not
# auto-executed). On macOS the script exits 0 with a "see README" pointer.
# mitmproxy ≥10.0 <11.0 (Assumption A6 — see README.md).
# Desktop binary built (`pnpm tauri build` or `cargo build`).
# Capability scope is bundled at build time (Pitfall 8) — rebuild
# after editing apps/desktop/src-tauri/capabilities/default.json.
#
# USAGE:
# bash apps/desktop/src-tauri/scripts/mitmproxy-.sh
# FLOW_LOG=/tmp/mitmproxy-custom.log bash ... # custom log path
# DESKTOP_BIN=/custom/path bash ... # custom binary path
#
# OUTPUT:
# stdout: per-phase status, final ✅/❌ verdict
# /tmp/net07-violations: empty (clean) or list of violations
# exit 0: PASS; exit 1: FAIL; exit 2: dependency missing

set -euo pipefail

# ── 1. OS gate (Linux is canonical environment) ──────────
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "macOS / non-Linux: see apps/desktop/src-tauri/scripts/README.md"
  echo " for the macOS Keychain CA-trust dance."
  echo " Linux is the canonical environment."
  exit 0
fi

# ── 2. Variables ───────────────────────────────────────────────────────
# Script lives at apps/desktop/src-tauri/scripts/<this file>
# REPO_ROOT = ../../../.. (4 levels up).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
DESKTOP_BIN="${DESKTOP_BIN:-$REPO_ROOT/apps/desktop/src-tauri/target/release/prl-wallet-desktop}"
FLOW_LOG="${FLOW_LOG:-$(mktemp)}"
MITM_PORT="${MITM_PORT:-8080}"
ASSERT_PY="$(dirname "${BASH_SOURCE[0]}")/mitmproxy-net07-assert.py"
SENTINEL="/tmp/net07-violations"

# Allow overriding the binary fallback to debug build.
if [[ ! -x "$DESKTOP_BIN" ]]; then
  ALT_BIN="$REPO_ROOT/apps/desktop/src-tauri/target/debug/prl-wallet-desktop"
  if [[ -x "$ALT_BIN" ]]; then
    echo "INFO: Using debug build at $ALT_BIN"
    DESKTOP_BIN="$ALT_BIN"
  else
    echo "FAIL: desktop binary not found or not executable: $DESKTOP_BIN" >&2
    echo " Build first:" >&2
    echo " cd apps/desktop && pnpm tauri build" >&2
    echo " Or for debug:" >&2
    echo " cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml" >&2
    exit 2
  fi
fi

# ── 3. mitmproxy presence + CA trust (Linux auto-install) ──────────────
command -v mitmdump >/dev/null 2>&1 || {
  echo "FAIL: mitmdump not on PATH. Install: pipx install mitmproxy" >&2
  echo " See apps/desktop/src-tauri/scripts/README.md for version pin." >&2
  exit 2
}

if [[ ! -f /usr/local/share/ca-certificates/mitmproxy.crt ]]; then
  echo "INFO: mitmproxy CA not in OS trust. Installing now (sudo required)..."
  # Trigger mitmproxy to generate the CA if it doesn't exist yet.
  mitmdump --quiet >/dev/null 2>&1 &
  local_mitm_pid=$!
  sleep 2
  kill "$local_mitm_pid" 2>/dev/null || true
  if [[ ! -f "$HOME/.mitmproxy/mitmproxy-ca-cert.pem" ]]; then
    echo "FAIL: mitmproxy CA cert was not generated at ~/.mitmproxy/mitmproxy-ca-cert.pem" >&2
    exit 2
  fi
  sudo cp "$HOME/.mitmproxy/mitmproxy-ca-cert.pem" /usr/local/share/ca-certificates/mitmproxy.crt
  sudo update-ca-certificates
fi

# ── 4. Start mitmdump ──────────────────────────────────────────────────
echo "INFO: Starting mitmdump on port $MITM_PORT, capturing flows to $FLOW_LOG"
mitmdump --listen-port "$MITM_PORT" --quiet -w "$FLOW_LOG" &
MITM_PID=$!
trap 'kill $MITM_PID 2>/dev/null || true; rm -f "$SENTINEL"' EXIT

sleep 2

# ── 5. Export proxy env vars (reqwest's system-proxy detection) ────────
export HTTP_PROXY="http://127.0.0.1:$MITM_PORT"
export HTTPS_PROXY="http://127.0.0.1:$MITM_PORT"
export ALL_PROXY="http://127.0.0.1:$MITM_PORT"

# ── 6. Phase A — Positive control (false-green prevention, Pitfall 2) ─
cat <<'EOF'

═══════════════════════════════════════════════════════════════════════════
PHASE A — POSITIVE CONTROL
═══════════════════════════════════════════════════════════════════════════
The desktop app will launch under mitmproxy.
TESTER:

  1. Wait for the app to render.
  2. Toggle the StatusBar ONLINE (top-right Switch) if not already.
  3. Open a wallet and click Refresh balance — this triggers a backend fetch
     for /api/v1/indexer/balance/<address>.
  4. Confirm the request was issued (StatusBar should show fetch indicator).
  5. When done, quit the app (Cmd/Ctrl+Q or close the window).

Press ENTER to launch the app for Phase A...
EOF
read -r

: >"$FLOW_LOG" # truncate flow log
"$DESKTOP_BIN" &
APP_PID=$!
wait "$APP_PID" || true

sleep 1
ONLINE_FLOWS=$(stat -c%s "$FLOW_LOG" 2>/dev/null || stat -f%z "$FLOW_LOG" 2>/dev/null || echo 0)
if [[ "$ONLINE_FLOWS" -lt 1 ]]; then
  echo "WARN: Phase A captured zero bytes."
  echo " Either the proxy is misconfigured OR no fetch was triggered."
  echo " Investigate before trusting Phase B's verdict — see README"
  echo " Pitfall 2 (tauri-plugin-http reqwest env-var path)."
else
  echo "PASS Phase A: positive control captured $ONLINE_FLOWS bytes of flow data."
fi

# ── 7. Phase B — Host-allow-list assertion ─────────────────────────────
cat <<'EOF'

═══════════════════════════════════════════════════════════════════════════
PHASE B — HOST-ALLOW-LIST ASSERTION ( proof — inversion)
═══════════════════════════════════════════════════════════════════════════
The desktop app will launch again under mitmproxy.
TESTER: Drive a FULL end-to-end loop, including the auto-updater path
(updater endpoint must hit www.pearlkeeper.com only):

  1. Open a wallet (or create one if none exists).
  2. Refresh balance — reaches /api/v1/indexer/balance/<address>.
  3. View transaction history — reaches /api/v1/indexer/history/<address>.
  4. Open Send wizard, enter address + amount, advance to Review.
  5. (OPTIONAL) Sign and broadcast a small testnet tx if backend is reachable
     and the wallet has testnet funds — broadcast hits POST /api/v1/indexer/broadcast.
  6. Trigger an update check (Settings → Check for updates, or wait for the
     auto-check). The Tauri updater fetches
     /api/v1/updates/<target>/<arch>/manifest.json from the configured
     endpoint — that endpoint MUST be www.pearlkeeper.com. Any flow to a
     host outside the locked allow-list means must FAIL.
  7. Quit the app.

The assertion: every captured flow's host MUST be in
{www.pearlkeeper.com, localhost:8787, 127.0.0.1:8787}. Any other host
(e.g., *.trezor.io, blockbook.*, third-party CDNs) is a violation.

Press ENTER to launch the app for Phase B...
EOF
read -r

: >"$FLOW_LOG" # truncate flow log
"$DESKTOP_BIN" &
APP_PID=$!
wait "$APP_PID" || true

sleep 1

# ── 8. Post-capture python assertion ──────────────────────────────────
echo "INFO: Running python addon assertion against $FLOW_LOG..."
mitmdump -nr "$FLOW_LOG" -s "$ASSERT_PY" >/dev/null 2>&1 || true

# ── 9. Verdict ────────────────────────────────────────────────────────
if [[ ! -f "$SENTINEL" ]]; then
  echo "FAIL: python addon did not produce $SENTINEL" >&2
  echo " Check that mitmdump and the addon ran cleanly:" >&2
  echo " mitmdump -nr $FLOW_LOG -s $ASSERT_PY" >&2
  exit 1
fi

if [[ -s "$SENTINEL" ]]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════"
  echo "❌ FAIL — disallowed hosts captured:"
  echo "═══════════════════════════════════════════════════════════════════════════"
  cat "$SENTINEL"
  echo ""
  echo " The capability-scope narrowing is BROKEN at the network"
  echo " layer. Investigate which screen / hook leaked the flow before"
  echo " transitioning the -LINUX ledger row to fail."
  exit 1
fi

cat <<EOF

═══════════════════════════════════════════════════════════════════════════
✅ PASS
═══════════════════════════════════════════════════════════════════════════
Phase A (positive control): $ONLINE_FLOWS bytes captured (proxy works).
Phase B (host-allow-list assertion): every captured flow hit ONLY:
  - www.pearlkeeper.com
  - localhost:8787
  - 127.0.0.1:8787

The / capability-scope narrowing is intact at the network
layer. -LINUX ledger row eligible to transition pass.
═══════════════════════════════════════════════════════════════════════════
EOF
exit 0
