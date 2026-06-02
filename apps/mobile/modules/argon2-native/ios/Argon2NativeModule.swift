import ExpoModulesCore

internal final class Argon2Exception: GenericException<String> {
  override var reason: String {
    "Argon2id hashing failed: \(param)"
  }
}

public class Argon2NativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Argon2Native")

    // AsyncFunction is dispatched off the JS thread, so the hash never blocks
    // the UI. Output is byte-identical to @noble/hashes argon2id (type id,
    // version 0x13, no key/AD) and to the Android BouncyCastle path.
    AsyncFunction("argon2idRaw") {
      (password: String, saltHex: String, t: Int, mKiB: Int, p: Int, dkLen: Int) throws -> String in
      // Argon2Bridge's trailing NSError** is auto-bridged to Swift `throws`,
      // so the call has no `error:` argument and returns a non-optional String.
      do {
        return try Argon2Bridge.argon2idRawHex(
          withPassword: password,
          saltHex: saltHex,
          t: Int32(t),
          mKiB: Int32(mKiB),
          p: Int32(p),
          dkLen: Int32(dkLen)
        )
      } catch {
        throw Argon2Exception(error.localizedDescription)
      }
    }
  }
}
