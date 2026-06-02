#!/usr/bin/env python3
# , — mitmproxy host-allow-list assertion addon.
#
# Purpose: After mitmdump captures flows from the desktop binary running
# under HTTPS_PROXY=mitmproxy, this addon re-reads the flow file
# (`mitmdump -nr <flow_file> -s <this_file>`) and asserts every flow's
# host is in the post-Phase-28 narrowed allow-list.
#
# Allow-list source: apps/desktop/src-tauri/capabilities/default.json
# ( lock) and apps/desktop/src-tauri/tauri.conf.json
# CSP connect-src ( lock) — must stay in sync.
#
# Sentinel-file IPC: mitmproxy's addon API cannot set the host process
# exit code, so we write violations (one per line) to
# /tmp/net07-violations. Empty file = clean. Non-empty = listed
# disallowed hosts. The shell runner reads the sentinel.
#
# Source pattern: https://docs.mitmproxy.org/stable/addons-overview/
# (mitmproxy 10.x stable; pinned >=10.0,<11.0 in README — Assumption A6).

from mitmproxy import http, ctx

# Locked at / — exactly 3 entries; must mirror
# apps/desktop/src-tauri/capabilities/default.json http:default.allow.
ALLOWED_HOSTS = {
    "www.pearlkeeper.com", # production backend (port 443 normalized)
    "localhost:8787", # dev backend
    "127.0.0.1:8787", # dev backend (numeric)
}

violations: list[str] = []
total: int = 0


def request(flow: http.HTTPFlow) -> None:
    """Called once per captured HTTP request flow."""
    global total
    total += 1
    host = flow.request.pretty_host
    port = flow.request.port
    # Normalize: 'www.pearlkeeper.com:443' -> 'www.pearlkeeper.com'
    # so we can compare against the bare-host entries in ALLOWED_HOSTS.
    host_port = host if port in (80, 443) else f"{host}:{port}"
    if host_port not in ALLOWED_HOSTS:
        violations.append(
            f"{host_port} ({flow.request.method} {flow.request.path})"
        )


def done() -> None:
    """End-of-run lifecycle hook (called by mitmproxy after all flows processed)."""
    ctx.log.info(f": {total} total flows; {len(violations)} violations")
    if violations:
        ctx.log.error("VIOLATIONS:")
        for v in violations:
            ctx.log.error(f" - {v}")
    # Sentinel: empty file = clean; non-empty = list of disallowed hosts.
    # Shell runner (mitmproxy-.sh) reads this to set its exit code.
    with open("/tmp/net07-violations", "w") as f:
        f.write("\n".join(violations))
