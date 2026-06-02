// apps/desktop/src/platform/attestation.ts — , , C-CORR-07.
//
// Desktop AttestationTokenPort. Private ed25519 seed never crosses the Tauri
// IPC boundary (T-27-DESK-01 mitigation): only public_key + per-request
// signatures cross. NetworkGate-aware (, ATTEST-07): closed gate = no
// enrollment, no token, undefined return.
//
// PATH NOTE: "## Integration Points" originally referenced
// apps/desktop/src/services/attestation.ts but that directory does not exist
// on desktop. We colocate at apps/desktop/src/platform/attestation.ts —
// matches existing `platform/` convention (storage.ts, networkGate.ts,
// secrets.adapter.ts, createServicePorts.ts all live here).
//
// PRE-IMAGE CONTRACT (cross-checked against backend desktopVerifier.ts):
// The Rust attestation_sign command computes
// digest = SHA256(body_hash || challenge)
// The backend desktopVerifier.computeDesktopSignaturePayload computes
// digest = SHA256(<base64(rawBody)>.<challenge>)
// For the digests to match byte-for-byte, the TS port passes
// body_hash = base64(bodyBytes) + "."
// to attestation_sign. The literal "." separator is appended by the JS
// side; Rust just concatenates body_hash || challenge. Backend then SHA-256s
// the same pre-image and ed25519-verifies against the registry-stored pubkey.

import { invoke } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";
import type {
  AttestationTokenPort,
  BackendApiClient,
} from "@prl-wallet/api-client";
import type { NetworkGatePort } from "@prl-wallet/app-adapters";

const STORE_FILE = "wallet-state.json";
const KEY_INSTANCE_ID = "attestation.instanceId";
const KEY_STATUS = "attestation.status";

type Status = "idle" | "enrolled" | "failed";

/**
 * Shape returned by the Rust `attestation_enroll` Tauri command. Mirrors the
 * `EnrollmentResult` struct in `apps/desktop/src-tauri/src/attestation.rs`.
 * Field names use snake_case because Tauri's serde Serialize default keeps
 * Rust struct field names verbatim (no rename).
 */
interface EnrollmentResult {
  public_key: string; // base64 — raw 32 bytes
  signature: string; // base64 — 64-byte ed25519 signature over SHA256(pubkey || challenge)
  instance_id: string; // hex — SHA256(public_key)
}

/**
 * Per-factory store loader. We deliberately do NOT memoize at module level
 * because (a) tests need the cache to be re-acquired per `createDesktopAttestationPort`
 * call, and (b) there's no production-runtime cost to a fresh `load()` call —
 * tauri-plugin-store internally deduplicates on file path.
 */
function makeStoreLoader(): () => Promise<Store> {
  let promise: Promise<Store> | null = null;
  return () => {
    if (!promise) {
      promise = load(STORE_FILE, { autoSave: false, defaults: {} });
    }
    return promise;
  };
}

/**
 * Browser-safe base64 (NOT base64url) encoding of a byte array. We use
 * String.fromCharCode + btoa rather than Buffer because the desktop renderer
 * is a browser context, and we want this module to run identically under
 * Vitest (jsdom) and the Tauri WebView.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return globalThis.btoa(s);
}

/**
 * Convert standard base64 (Rust output) to base64url so the wire token is
 * URL-safe. The backend middleware reads `signatureB64url` from
 * `desktop.<instance_id>.<sig>` and converts back to base64 internally before
 * handing to crypto.verify.
 */
function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export interface DesktopAttestationDeps {
  /**
   * Enrollment-capable BackendApiClient. /07 wires this — the same
   * client instance can serve enrollment (`getAttestationChallenge` /
   * `enrollDesktop`, both flagged `skipAttestation: true` so they bypass the
   * port even when wired) AND post-enrollment authenticated requests.
   */
  apiClient: BackendApiClient;
  /**
   * four-layer offline gate. While `isOpen()` returns false, the port
   * MUST return undefined immediately — no enrollment, no signing, no token.
   * This honors ATTEST-07 (offline-first launch does not block enrollment;
   * the next call after the gate opens kicks it off).
   */
  networkGate: NetworkGatePort;
}

/**
 * Factory for the desktop AttestationTokenPort. The returned `getToken`
 * NEVER throws — contract preserved: any internal error
 * (offline, Tauri invoke failure, plugin-store I/O, backend rejection) maps
 * to `undefined`, which `BackendApiClient.fetchWithTimeout` translates to
 * "attach NEITHER attestation header" → tier 0.
 */
export function createDesktopAttestationPort(
  deps: DesktopAttestationDeps,
): AttestationTokenPort {
  const getStore = makeStoreLoader();
  // Concurrent-call dedupe: N parallel queries on app boot would otherwise
  // each fire their own getAttestationChallenge → enrollDesktop pair and
  // burn the 30/min/IP challenge quota in seconds ( quota in
  // apps/backend/src/services/abuseCounters.ts). Hold a single in-flight
  // enrollment promise; concurrent callers await the same one.
  let enrollmentInFlight: Promise<void> | null = null;
  return {
    async getToken(req?: {
      bodyBytes?: Uint8Array;
    }): Promise<{ token: string; challenge: string } | undefined> {
      try {
        console.log("[attest] getToken entered");
        // (1) Honor the offline gate (, ATTEST-07). MUST be the first
        // check — must NOT consult plugin-store or invoke any Tauri command
        // while the gate is closed.
        if (!deps.networkGate.isOpen()) {
          console.log("[attest] gate closed → undefined");
          return undefined;
        }

        const store = await getStore();
        const status = ((await store.get<Status>(KEY_STATUS)) ??
          "idle") as Status;
        const cachedInstanceId =
          (await store.get<string>(KEY_INSTANCE_ID)) ?? null;
        console.log("[attest] store:", { status, cachedInstanceId, inFlight: !!enrollmentInFlight });

        // (2) Enroll if not yet enrolled (idempotent on the Rust side too —
        // load_or_generate_signing_key() reuses the existing keychain seed
        // if present, only generates fresh on first launch).
        if (status !== "enrolled" || !cachedInstanceId) {
          if (!enrollmentInFlight) {
            enrollmentInFlight = (async () => {
              const challengeRes =
                await deps.apiClient.getAttestationChallenge();
              const enroll = await invoke<EnrollmentResult>(
                "attestation_enroll",
                { challenge: challengeRes.challenge },
              );
              const result = await deps.apiClient.enrollDesktop({
                publicKey: enroll.public_key,
                signature: enroll.signature,
                challenge: challengeRes.challenge,
              });
              await store.set(KEY_INSTANCE_ID, result.instanceId);
              await store.set(KEY_STATUS, "enrolled" satisfies Status);
              await store.save();
            })();
            // Clear the slot on rejection so the next caller can retry;
            // keep it set on success so concurrent waiters all see done.
            enrollmentInFlight.catch(() => {
              enrollmentInFlight = null;
            });
          }
          await enrollmentInFlight;
          // First call (and concurrent siblings awaiting the same enrollment)
          // don't carry an attestation token — the request that triggered
          // enrollment goes tier 0; the NEXT request enjoys tier 1. Matches
          // the iOS / Android port contract ().
          return undefined;
        }

        // (3) Per-request signing path (C-CORR-06 + C-CORR-07).
        // Fetch a fresh challenge (every authenticated request gets its
        // own challenge so a captured token cannot be reused for a
        // different request body).
        // Pass `body_hash = base64(body) + "."` to Rust so the
        // concatenated pre-image `<base64body>.<challenge>` matches
        // backend's `SHA256(<base64(rawBody)>.<challenge>)`.
        // Bundle `{ token, challenge }` so BackendApiClient can attach
        // BOTH headers atomically (or NEITHER on undefined).
        const { challenge } = await deps.apiClient.getAttestationChallenge();
        const bodyBytes = req?.bodyBytes ?? new Uint8Array(0);
        const bodyB64 = bytesToBase64(bodyBytes);
        const bodyHashArg = `${bodyB64}.`;
        // Tauri 2.x auto-converts JS-side parameter names to camelCase before
        // matching against Rust function args. Rust declares `body_hash`, so
        // we MUST send `bodyHash` from JS — not `body_hash` (which Tauri 2's
        // serde layer rejects with "missing required key bodyHash").
        // fix (DI-29-UAT-05) — surfaced during macOS desktop UAT.
        const signatureB64 = await invoke<string>("attestation_sign", {
          challenge,
          bodyHash: bodyHashArg,
        });
        return {
          token: `desktop.${cachedInstanceId}.${toBase64Url(signatureB64)}`,
          challenge,
        };
      } catch (e) {
        console.log("[attest] threw:", e);
        // contract — never throw; any failure maps to tier-0.
        return undefined;
      }
    },
  };
}
