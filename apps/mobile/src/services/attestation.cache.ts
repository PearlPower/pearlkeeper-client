// apps/mobile/src/services/attestation.cache.ts — .
// AsyncStorage-backed cache state machine. NOT SecureStore — these values
// are not secrets (instance_id is anonymous; status / last_attempt_at /
// failure_count are operational metadata). Per (lines 160-163)
// + RESEARCH Pitfall 3 backoff schedule + ATTEST-07 offline-first launch.
//
// State machine:
// idle → pending → enrolled (success)
// idle → pending → failed (failure; backoff anchor recorded)
// enrolled → idle (ERR_APP_INTEGRITY_INVALID_KEY — port
// clears keyId + resets cache)
//
// Backoff schedule (): 1m, 5m, 30m, 6h cap on consecutive failures so
// failed enrollment retries do not hammer the backend.
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AttestationStatus = "idle" | "pending" | "enrolled" | "failed";

const KEY_INSTANCE_ID = "prl_attestation_instance_id";
const KEY_STATUS = "prl_attestation_status";
const KEY_LAST_ATTEMPT = "prl_attestation_last_attempt_at";
const KEY_FAILURE_COUNT = "prl_attestation_failure_count";

// Backoff schedule per : 1m, 5m, 30m, 6h cap.
export const BACKOFF_MS: number[] = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  6 * 60 * 60_000,
];

function backoffForCount(count: number): number {
  const idx = Math.min(Math.max(count - 1, 0), BACKOFF_MS.length - 1);
  return BACKOFF_MS[idx]!;
}

export interface AttestationCache {
  getStatus(): Promise<AttestationStatus>;
  getInstanceId(): Promise<string | null>;
  isEnrolled(): Promise<boolean>;
  setStatus(next: AttestationStatus, instanceId?: string): Promise<void>;
  shouldRetry(): Promise<boolean>;
  reset(): Promise<void>;
}

export function createAttestationCache(): AttestationCache {
  return {
    async getStatus(): Promise<AttestationStatus> {
      try {
        const raw = await AsyncStorage.getItem(KEY_STATUS);
        return (raw as AttestationStatus | null) ?? "idle";
      } catch {
        return "idle";
      }
    },
    async getInstanceId(): Promise<string | null> {
      try {
        return await AsyncStorage.getItem(KEY_INSTANCE_ID);
      } catch {
        return null;
      }
    },
    async isEnrolled(): Promise<boolean> {
      try {
        return (await AsyncStorage.getItem(KEY_STATUS)) === "enrolled";
      } catch {
        return false;
      }
    },
    async setStatus(
      next: AttestationStatus,
      instanceId?: string,
    ): Promise<void> {
      await AsyncStorage.setItem(KEY_STATUS, next);
      if (instanceId !== undefined) {
        await AsyncStorage.setItem(KEY_INSTANCE_ID, instanceId);
      }
      if (next === "failed") {
        await AsyncStorage.setItem(KEY_LAST_ATTEMPT, String(Date.now()));
        const prev =
          parseInt((await AsyncStorage.getItem(KEY_FAILURE_COUNT)) ?? "0", 10) ||
          0;
        await AsyncStorage.setItem(KEY_FAILURE_COUNT, String(prev + 1));
      } else if (next === "enrolled") {
        await AsyncStorage.setItem(KEY_FAILURE_COUNT, "0");
      }
    },
    async shouldRetry(): Promise<boolean> {
      const status = (await AsyncStorage.getItem(
        KEY_STATUS,
      )) as AttestationStatus | null;
      if (status === "enrolled") return false;
      // Allow retry for idle (no prior attempt) or pending (race / restart).
      if (status !== "failed") return true;
      const lastAttemptRaw = await AsyncStorage.getItem(KEY_LAST_ATTEMPT);
      const failureCountRaw = await AsyncStorage.getItem(KEY_FAILURE_COUNT);
      const lastAttempt = lastAttemptRaw
        ? parseInt(lastAttemptRaw, 10) || 0
        : 0;
      const failureCount = failureCountRaw
        ? parseInt(failureCountRaw, 10) || 0
        : 0;
      const elapsed = Date.now() - lastAttempt;
      return elapsed >= backoffForCount(failureCount);
    },
    async reset(): Promise<void> {
      await AsyncStorage.removeItem(KEY_INSTANCE_ID);
      await AsyncStorage.removeItem(KEY_STATUS);
      await AsyncStorage.removeItem(KEY_LAST_ATTEMPT);
      await AsyncStorage.removeItem(KEY_FAILURE_COUNT);
    },
  };
}
