// Jest mock for the local `argon2-native` Expo module. The real module imports
// expo-modules-core, whose index can't initialize in the node/jest runtime.
// Reporting the native module as unavailable makes secureStorage fall back to
// the pure-JS @noble implementation — the same code path tests exercised
// before the native module existed.

export const isArgon2NativeAvailable = false;

export function argon2idRawHex(): Promise<string> {
  return Promise.reject(new Error("ARGON2_NATIVE_UNAVAILABLE"));
}
