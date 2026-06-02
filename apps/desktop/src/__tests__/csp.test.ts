// + — locked CSP directives.
//
// narrows connect-src from wildcard Blockbook hosts
// (https://*.pearlkeeper.com, https://*.trezor.io) to the single locked
// backend host, path-scoped to the API surface (https://www.pearlkeeper.com/api/).
// The trailing-slash form is a CSP path prefix so /api/v1/... matches while the
// www landing root does not. Wildcards must NOT reappear — that's grep guard G-5.
//
// The two dev localhost entries (http://localhost:8787, http://127.0.0.1:8787)
// live ONLY in `devCsp` (applied by Tauri during `tauri dev`), never in the
// production `csp` that ships in the bundled binary — so released artifacts
// don't advertise the local dev toolchain.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe(" + : tauri.conf.json CSP directives", () => {
  const conf = JSON.parse(
    readFileSync(
      join(__dirname, "..", "..", "src-tauri", "tauri.conf.json"),
      "utf8",
    ),
  );
  const csp = conf.app.security.csp as string;
  const devCsp = conf.app.security.devCsp as string;

  it.each([
    "worker-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "https://www.pearlkeeper.com/api/",
    "connect-src 'self' ipc: http://ipc.localhost",
  ])("CSP contains directive %s", (frag) => {
    expect(csp).toContain(frag);
  });

  it.each(["http://localhost:8787", "http://127.0.0.1:8787"])(
    "production CSP does NOT ship dev localhost entry %s",
    (frag) => {
      expect(csp).not.toContain(frag);
    },
  );

  it.each(["http://localhost:8787", "http://127.0.0.1:8787"])(
    "devCsp DOES contain dev localhost entry %s",
    (frag) => {
      expect(devCsp).toContain(frag);
    },
  );

  it.each(["https://*.pearlkeeper.com", "https://*.trezor.io"])(
    "CSP does NOT contain post-cutover-banned wildcard %s",
    (frag) => {
      expect(csp).not.toContain(frag);
      expect(devCsp).not.toContain(frag);
    },
  );

  it("CSP full string snapshot", () => {
    expect(csp).toMatchSnapshot();
  });

  it("devCsp full string snapshot", () => {
    expect(devCsp).toMatchSnapshot();
  });
});
