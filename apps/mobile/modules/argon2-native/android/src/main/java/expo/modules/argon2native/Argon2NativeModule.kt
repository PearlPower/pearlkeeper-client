package expo.modules.argon2native

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.bouncycastle.crypto.generators.Argon2BytesGenerator
import org.bouncycastle.crypto.params.Argon2Parameters

class Argon2NativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Argon2Native")

    // AsyncFunction runs on a background executor, so the heavy hash never
    // touches the JS/UI thread. Output is byte-identical to @noble/hashes
    // argon2id for the same inputs (type id, version 0x13, no key/AD).
    AsyncFunction("argon2idRaw") {
      password: String,
      saltHex: String,
      t: Int,
      mKiB: Int,
      p: Int,
      dkLen: Int ->
      argon2idRaw(password, saltHex, t, mKiB, p, dkLen)
    }
  }

  private fun argon2idRaw(
    password: String,
    saltHex: String,
    t: Int,
    mKiB: Int,
    p: Int,
    dkLen: Int,
  ): String {
    val salt = hexToBytes(saltHex)
    val params = Argon2Parameters.Builder(Argon2Parameters.ARGON2_id)
      .withVersion(Argon2Parameters.ARGON2_VERSION_13)
      .withIterations(t)
      .withMemoryAsKB(mKiB)
      .withParallelism(p)
      .withSalt(salt)
      .build()

    val generator = Argon2BytesGenerator()
    generator.init(params)
    val out = ByteArray(dkLen)
    generator.generateBytes(password.toByteArray(Charsets.UTF_8), out, 0, out.size)
    return bytesToHex(out)
  }

  private fun hexToBytes(hex: String): ByteArray {
    if (hex.length % 2 != 0) {
      throw InvalidHexException()
    }
    val out = ByteArray(hex.length / 2)
    var i = 0
    while (i < hex.length) {
      val hi = Character.digit(hex[i], 16)
      val lo = Character.digit(hex[i + 1], 16)
      if (hi < 0 || lo < 0) {
        throw InvalidHexException()
      }
      out[i / 2] = ((hi shl 4) or lo).toByte()
      i += 2
    }
    return out
  }

  private fun bytesToHex(bytes: ByteArray): String {
    val hexChars = "0123456789abcdef"
    val sb = StringBuilder(bytes.size * 2)
    for (b in bytes) {
      val v = b.toInt() and 0xFF
      sb.append(hexChars[v ushr 4])
      sb.append(hexChars[v and 0x0F])
    }
    return sb.toString()
  }
}

private class InvalidHexException :
  CodedException("ARGON2_INVALID_HEX", "Salt is not valid hex", null)
