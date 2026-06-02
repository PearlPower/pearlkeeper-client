import Argon2Native from "./src/Argon2NativeModule";

export type { Argon2NativeModuleType } from "./src/Argon2NativeModule";

/** True when a native Argon2id implementation is linked for this platform. */
export const isArgon2NativeAvailable = Argon2Native != null;

/**
 * Raw Argon2id → hex. Throws if the native module is unavailable; check
 * `isArgon2NativeAvailable` first or wrap in a try/catch with a JS fallback.
 */
export function argon2idRawHex(
  password: string,
  saltHex: string,
  t: number,
  mKiB: number,
  p: number,
  dkLen: number,
): Promise<string> {
  if (!Argon2Native) {
    throw new Error("ARGON2_NATIVE_UNAVAILABLE");
  }
  return Argon2Native.argon2idRaw(password, saltHex, t, mKiB, p, dkLen);
}
