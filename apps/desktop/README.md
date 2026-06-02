# PRL Wallet — Desktop (Tauri)

This is the Tauri desktop shell for PRL Wallet. Day-to-day commands live in
the workspace root; this file documents desktop-specific gotchas the rest of
the monorepo doesn't surface.

## Dev gotchas

### Tauri capability scope edits do NOT hot-reload

After editing `src-tauri/capabilities/default.json` or `src-tauri/tauri.conf.json`
you MUST restart `tauri dev`. The capability scope and CSP are baked into the
Rust binary at build time; HMR only reloads the WebView bundle, not the Rust
side. Symptom: requests to a host you just added are still rejected by
`plugin-http` until the next `tauri dev` start. ( / Pitfall C-NEW-06.)

### Backend base URL override (+)

Production default is `https://www.pearlkeeper.com`. Override locally via
`apps/desktop/.env.development.local`:

```
VITE_BACKEND_BASE_URL=http://localhost:8787
```

The Tauri capability scope already allows `http://localhost:8787/*` and
`http://127.0.0.1:8787/*` for dev. Anything else (e.g. a LAN IP) requires
adding the host to `src-tauri/capabilities/default.json` and the
`connect-src` directive of `src-tauri/tauri.conf.json` — followed by a full
`tauri dev` restart per the note above.

### `scopedFetch.ts` is the only file allowed to import a network primitive

All HTTP from the WebView routes through Rust via `@tauri-apps/plugin-http`.
`apps/desktop/src/platform/scopedFetch.ts` is the sole import site for
`@tauri-apps/plugin-http`'s `fetch` (). Don't add new
network-primitive imports anywhere else; the ESLint config forbids it.
