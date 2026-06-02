import { requireOptionalNativeModule } from "expo-modules-core";

export interface Argon2NativeModuleType {
  /**
   * Compute a raw Argon2id hash and return it as a lowercase hex string.
   *
   * Runs on a native background thread (Expo AsyncFunction), so it never
   * blocks the JS/UI thread the way the pure-JS @noble implementation does.
   *
   * Parameters map 1:1 to @noble/hashes argon2id so output is byte-identical:
   * type: Argon2id, version: 0x13 (RFC 9106)
   * mKiB: memory cost in KiB (e.g. 19456 for 19 MiB)
   * no secret key / associated data / personalization
   *
   * @param password UTF-8 password (the PIN)
   * @param saltHex salt as lowercase hex
   * @param t iterations (time cost)
   * @param mKiB memory cost in KiB
   * @param p parallelism (lanes)
   * @param dkLen output length in bytes
   */
  argon2idRaw(
    password: string,
    saltHex: string,
    t: number,
    mKiB: number,
    p: number,
    dkLen: number,
  ): Promise<string>;
}

// Returns null (instead of throwing) when the native module is not present —
// e.g. Expo Go, web, or a JS-only test environment. Callers fall back to the
// pure-JS @noble implementation in that case.
export default requireOptionalNativeModule<Argon2NativeModuleType>(
  "Argon2Native",
);
