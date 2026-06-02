// + — locked CSP directives.
//
// narrows connect-src from wildcard Blockbook hosts
// (https://*.pearlkeeper.com, https://*.trezor.io) to the single locked
// backend host, path-scoped to the API surface (https://www.pearlkeeper.com/api/)
// plus the two dev localhost entries (http://localhost:8787,
// http://127.0.0.1:8787). The trailing-slash form is a CSP path prefix so
// /api/v1/... matches while the www landing root does not. Wildcards must
// NOT reappear — that's grep guard G-5.

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

  it.each([
    "worker-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "https://www.pearlkeeper.com/api/",
    "http://localhost:8787",
    "http://127.0.0.1:8787",
    "connect-src 'self' ipc: http://ipc.localhost",
  ])("CSP contains directive %s", (frag) => {
    expect(csp).toContain(frag);
  });

  it.each(["https://*.pearlkeeper.com", "https://*.trezor.io"])(
    "CSP does NOT contain post-cutover-banned wildcard %s",
    (frag) => {
      expect(csp).not.toContain(frag);
    },
  );

  it("CSP full string snapshot", () => {
    expect(csp).toMatchSnapshot();
  });
});
