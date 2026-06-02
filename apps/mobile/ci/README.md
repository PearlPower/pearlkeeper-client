# Mobile CI Helpers

- `write-build-manifest.ts` — emits `build-manifest.<platform>.json` (version,
  build number, SHA-256 of the artifact, commit SHA, tag). Run from the
  fastlane `ios :build` / `android :build` lanes after the artifact lands.
- `push-build-number-tag.sh` — pushes `mobile-v<sem>-<platform>.<buildNumber>`
  as an annotated git tag. Idempotent.

Both scripts are invoked from `apps/mobile/fastlane/Fastfile`; you shouldn't
need to call them manually.
