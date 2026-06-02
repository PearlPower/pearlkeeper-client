// apps/mobile/src/services/attestation.ts — , , , C-CORR-01..03 + C-CORR-07.
// added createMobileAttestationPort dispatcher (Platform.OS-aware).
// iOS: @expo/app-integrity generateKeyAsync + attestKeyAsync + generateAssertionAsync.
// Android: prepare-once + per-request integrity check (see prepare/request below).
// Both ports return undefined on any error — contract.
//
// Symmetric body-binding (C-CORR-02 generalized): both platforms construct
// the pre-image string `<base64(rawBody)>.<serverChallenge>`. iOS passes this
// AS the challenge string to ExpoAppIntegrity (the native module SHA-256s it
// internally before handing to DCAppAttestService). Android SHA-256s the same
// pre-image into a base64url request-hash for the Play Integrity verdict —
// Standard Play Integrity API binds it inside
// `tokenPayloadExternal.requestDetails.requestHash` (C-CORR-03 — no separate
// extra header is sent client-side; everything rides inside the verdict).
//
// C-CORR-07: getToken returns `{ token, challenge } | undefined`. Both header
// values are delivered atomically to BackendApiClient.fetchWithTimeout.
//
// API note (deviation from plan draft): `@expo/app-integrity@55.0.13` exports
// the integrity check as a MODULE-LEVEL function returning `Promise<string>`
// (the integrity token), not a method on a provider object. The prepare call
// returns `Promise<void>` and takes a STRING cloudProjectNumber. We honor the
// real library shape.
import * as ExpoAppIntegrity from "@expo/app-integrity";
import * as SecureStore from "expo-secure-store";
import { sha256 } from "@noble/hashes/sha256";
import type {
  AttestationTokenPort,
  BackendApiClient,
} from "@prl-wallet/api-client";
import type { AttestationCache } from "./attestation.cache";

const KEY_ID_STORAGE = "prl_attestation_ios_keyId";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert raw bytes to standard base64. RN does not have a built-in utility
 * for Uint8Array → base64; we go through `globalThis.btoa` via String.fromCharCode
 * (RN runtime ships btoa via core-js; matches the platform invariant). */
function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  return globalThis.btoa(s);
}

/** Convert raw bytes to base64url (RFC 4648 §5 — no padding, '+'→'-', '/'→'_'). */
function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** C-CORR-02 symmetric pre-image: `<base64(rawBody)>.<serverChallenge>`.
 * iOS: passed AS the challenge string to attestKeyAsync / generateAssertionAsync
 * (Apple's native module SHA-256s internally; do NOT pre-hash).
 * Android: SHA-256'd into base64url to feed requestIntegrityCheckAsync.
 * Backend SHA-256s the SAME pre-image when verifying — symmetric binding. */
export function challengePreImage(
  bodyBytes: Uint8Array | undefined,
  challenge: string,
): string {
  return `${bytesToBase64(bodyBytes ?? new Uint8Array())}.${challenge}`;
}

// ─── iOS port ────────────────────────────────────────────────────────────────

export interface IosAttestationDeps {
  /** Enrollment-only client — instantiated WITHOUT an attestationToken so its
   * enroll calls do not chicken-and-egg through the very middleware they're
   * trying to register against (). */
  apiClient: BackendApiClient;
  cache: AttestationCache;
}

export function createIosAttestationPort(
  deps: IosAttestationDeps,
): AttestationTokenPort {
  return {
    async getToken(req?: {
      bodyBytes?: Uint8Array;
    }): Promise<{ token: string; challenge: string } | undefined> {
      try {
        // Apple App Attest unsupported on simulator / unsupported hardware.
        // ExpoAppIntegrity.isSupported is iOS-only; on Android it's undefined,
        // which `!isSupported` evaluates true → returns undefined (graceful).
        if (!ExpoAppIntegrity.isSupported) return undefined;

        const bodyBytes = req?.bodyBytes;

        // Read persisted keyId from per-secret SecureStore entry (analog of
        // secureStorage.ts pattern; per-secret keychain accessibility option).
        let keyId: string | null;
        try {
          keyId = await SecureStore.getItemAsync(KEY_ID_STORAGE);
        } catch {
          keyId = null;
        }

        // ─── First-call enrollment ───
        if (!keyId) {
          if (!(await deps.cache.shouldRetry())) return undefined;
          await deps.cache.setStatus("pending");
          const { challenge } = await deps.apiClient.getAttestationChallenge();
          const preImage = challengePreImage(bodyBytes, challenge);
          const newKeyId = await ExpoAppIntegrity.generateKeyAsync();
          const attestation = await ExpoAppIntegrity.attestKeyAsync(
            newKeyId,
            preImage,
          );
          const result = await deps.apiClient.enrollIos({
            keyId: newKeyId,
            attestation,
            challenge,
          });
          await SecureStore.setItemAsync(KEY_ID_STORAGE, newKeyId, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
          await deps.cache.setStatus("enrolled", result.instanceId);
          // First call kicks off enrollment; this request goes tier 0 (no
          // token attached). Next request will carry the assertion.
          return undefined;
        }

        // ─── Per-request assertion (C-CORR-06 + C-CORR-07) ───
        // Return BOTH the token and the challenge so BackendApiClient attaches
        // x-attestation-token AND x-attestation-challenge atomically.
        const { challenge } = await deps.apiClient.getAttestationChallenge();
        const preImage = challengePreImage(bodyBytes, challenge);
        const assertion = await ExpoAppIntegrity.generateAssertionAsync(
          keyId,
          preImage,
        );
        return { token: `ios.${keyId}.${assertion}`, challenge };
      } catch (err: unknown) {
        // ATTEST-01: clear keyId on Apple-side revocation. Force re-enroll
        // on next call by resetting cache to idle.
        const code = (err as { code?: string } | null)?.code;
        const message = err instanceof Error ? err.message : String(err);
        const isInvalidKey =
          code === "ERR_APP_INTEGRITY_INVALID_KEY" ||
          /ERR_APP_INTEGRITY_INVALID_KEY/i.test(message);
        if (isInvalidKey) {
          try {
            await SecureStore.deleteItemAsync(KEY_ID_STORAGE);
          } catch {
            /* ignore */
          }
          try {
            await deps.cache.setStatus("idle");
          } catch {
            /* ignore */
          }
        } else {
          try {
            await deps.cache.setStatus("failed");
          } catch {
            /* ignore */
          }
        }
        // contract — never throw.
        return undefined;
      }
    },
  };
}

// ─── Android port ───────────────────────────────────────────────────────────

export interface AndroidAttestationDeps {
  apiClient: BackendApiClient;
  cache: AttestationCache;
  /** Google Cloud project number (numeric string) sourced from
   * EXPO_PUBLIC_ANDROID_CLOUD_PROJECT_NUMBER per . */
  cloudProjectNumber: string;
}

export function createAndroidAttestationPort(
  deps: AndroidAttestationDeps,
): AttestationTokenPort {
  // Pitfall 3: Standard Play Integrity API requires the prepare call once
  // per app launch BEFORE any per-request integrity check. We cache the
  // prepare promise per port instance; first getToken awaits prepare,
  // subsequent calls reuse the same resolved promise.
  let preparePromise: Promise<void> | null = null;

  function getPrepared(): Promise<void> {
    if (!preparePromise) {
      preparePromise = ExpoAppIntegrity.prepareIntegrityTokenProviderAsync(
        deps.cloudProjectNumber,
      );
    }
    return preparePromise;
  }

  return {
    async getToken(req?: {
      bodyBytes?: Uint8Array;
    }): Promise<{ token: string; challenge: string } | undefined> {
      try {
        await getPrepared();
        const { challenge } = await deps.apiClient.getAttestationChallenge();
        const bodyBytes = req?.bodyBytes ?? new Uint8Array();
        // Symmetric pre-image with iOS (C-CORR-02 generalized).
        const preImageStr = challengePreImage(bodyBytes, challenge);
        // C-CORR-03: requestHash is base64url(SHA256(<base64(body)>.<challenge>))
        // Standard Play Integrity API binds this INSIDE the verdict at
        // tokenPayloadExternal.requestDetails.requestHash. NO separate header.
        const requestHash = bytesToBase64Url(
          sha256(new TextEncoder().encode(preImageStr)),
        );
        const integrityToken = await ExpoAppIntegrity.requestIntegrityCheckAsync(
          requestHash,
        );

        // First-call enrollment — register the row before normal per-request
        // flow can succeed downstream.
        if (!(await deps.cache.isEnrolled())) {
          if (!(await deps.cache.shouldRetry())) return undefined;
          await deps.cache.setStatus("pending");
          const result = await deps.apiClient.enrollAndroid({
            integrityToken,
            challenge,
          });
          await deps.cache.setStatus("enrolled", result.instanceId);
        }

        // C-CORR-07: return BOTH token and challenge atomically.
        return { token: `android.${integrityToken}`, challenge };
      } catch {
        // Reset failed cache anchor for backoff. — never throw.
        try {
          await deps.cache.setStatus("failed");
        } catch {
          /* ignore */
        }
        return undefined;
      }
    },
  };
}

// ─── Mobile dispatcher () ─────────────────────────────────
//
// createServicePorts.ts wires `attestationToken: createMobileAttestationPort({...})`
// into the production BackendApiClient. The dispatcher branches on Platform.OS
// at construction time and returns the appropriate platform-specific port.
//
// `apiClient` is an *enrollment-only* BackendApiClient — instantiated WITHOUT
// an attestationToken so the chicken-and-egg loop () is broken:
// enroll calls cannot themselves carry attestation headers because they ARE
// the source of attestation.

import { Platform } from "react-native";

export interface MobileAttestationDeps {
  /** Enrollment-only BackendApiClient (no attestationToken on this client). */
  apiClient: BackendApiClient;
  cache: AttestationCache;
  /** Required only on Android — Google Cloud project number for Play Integrity. */
  androidCloudProjectNumber?: string;
}

/**
 * Platform-aware attestation port factory. Returns:
 * iOS: createIosAttestationPort(deps)
 * Android: createAndroidAttestationPort({...deps, cloudProjectNumber})
 * other: a no-op port (web / test) — getToken returns undefined, which
 * causes BackendApiClient to send tier-0 traffic (no headers).
 *
 * contract: getToken NEVER throws.
 */
export function createMobileAttestationPort(
  deps: MobileAttestationDeps,
): AttestationTokenPort {
  if (Platform.OS === "ios") {
    return createIosAttestationPort({
      apiClient: deps.apiClient,
      cache: deps.cache,
    });
  }
  if (Platform.OS === "android") {
    if (!deps.androidCloudProjectNumber) {
      // Without a cloud project number, Play Integrity prepare would throw on
      // first call. Return a no-op port instead so the app degrades to tier 0
      // gracefully ( contract: never throw).
      return { async getToken() { return undefined; } };
    }
    return createAndroidAttestationPort({
      apiClient: deps.apiClient,
      cache: deps.cache,
      cloudProjectNumber: deps.androidCloudProjectNumber,
    });
  }
  // Non-mobile runtimes (web preview, jest test runner without RN preset) —
  // return a no-op so callers don't have to branch.
  return { async getToken() { return undefined; } };
}
