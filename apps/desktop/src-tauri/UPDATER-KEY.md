# Tauri Updater Minisign Keypair — Setup Runbook

> **.. / BACKEND-04** — one-time setup. Generated locally,
> committed pubkey, private key uploaded to GitHub `release` Environment,
> local copy deleted. Re-run only when rotating the key.

## 1. Why this key exists

The Tauri auto-updater plugin (consumed in ****) verifies update bundles
with an Ed25519 minisign signature. Without this keypair:
- No work can ship signed updates.
- A compromised CDN could ship malicious updates that pass our installer's
  current signature check (none → trivially forgeable).

This key is **separate** from the backend ed25519 config-signing key
(). Different storage, different rotation cadence:

| Key | Used for | Storage | Rotation |
| -------------------------------------- | -------------------------------- | ------------------------------------ | --------------- |
| Tauri updater minisign (this document) | Signing desktop update bundles | GitHub `release` Environment secret | Manual; rare |
| Backend config-signing ed25519 () | Signing JSON config envelopes | Backend `CONFIG_SIGNING_SECRET_KEY` | Annual; planned |

The backend process MUST NEVER have access to the updater key (Pitfall C-11).

## 2. Generate the keypair (one-time, local workstation)

Install `rsign2` (pure-Rust minisign CLI; signatures interoperable with the
stock `minisign` and `tauri signer` tools). Version pinned to `0.6.4` per
research SUMMARY:

```
cargo install rsign2 --version 0.6.4
```

Generate the keypair from the repo root:

```
rsign generate \
  -p apps/desktop/src-tauri/updater-pubkey.pub \
  -s minisign.sec
```

`rsign` will prompt interactively for a passphrase. Choose a strong passphrase;
you will need it again in Step 3.

Verify the public key file looks correct:

```
head -1 apps/desktop/src-tauri/updater-pubkey.pub
# Expected: untrusted comment: minisign public key <hex-id>
```

## 3. Upload private key to GitHub `release` Environment

Confirm you are authenticated against the correct repo:

```
gh auth status
gh repo view --json name
```

Upload the private key contents and the passphrase as Environment secrets
scoped to the existing `release` Environment (the same Environment that gates
the v1.3 release pipeline; required-reviewers gate already in place — no new
policy needed):

```
gh secret set TAURI_UPDATER_PRIVATE_KEY --env release < minisign.sec
gh secret set TAURI_UPDATER_PRIVATE_KEY_PASSWORD --env release
# (gh prompts for the passphrase value; paste it without trailing newline)
```

Confirm both secrets are present:

```
gh secret list --env release
# Expected to show: TAURI_UPDATER_PRIVATE_KEY, TAURI_UPDATER_PRIVATE_KEY_PASSWORD
```

## 4. Cleanup local artifacts + offline backup

Back up `minisign.sec` to an offline-only location (1Password, hardware token,
or paper minisign-format backup). Then delete the local copy:

```
rm minisign.sec
```

The local copy MUST NOT remain on the workstation: a stolen laptop should not
carry the production updater key.

## 5. Commit the public key

The public key file is **intentionally** committed to the repo (public keys
are public; this matches Tauri convention):

```
git add apps/desktop/src-tauri/updater-pubkey.pub apps/desktop/src-tauri/UPDATER-KEY.md
git commit -m "feat(25-02): generate Tauri updater minisign keypair (BACKEND-04 / ..)"
```

The CI job `ci` runs three lint steps that fail the build if either file is
missing or empty (`.github/workflows/ci.yml` `lint:envprefix` and the two
`Verify Tauri updater ...` steps).

## 6. Rotation policy

- **When**: rotate manually if the private key is suspected compromised, or
  proactively at most once per year.
- **How**: re-run Steps 2–5 in this document. The Tauri updater can verify
  signatures from any of N committed public keys (multi-key support is
  implemented in ; for now we ship one public key).
- **Tracking**: log every rotation in `` under
  "Open Items / Blockers" with date + reason. 's auto-updater config
  must be updated to point at the new pubkey filename in the same commit.
