// packages/core/src/mnemonic.ts
import {
  generateMnemonic as bip39Generate,
  validateMnemonic as bip39Validate,
  mnemonicToSeed as bip39Seed,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

export function generateMnemonic(strength: 128 | 256 = 128): string {
  return bip39Generate(wordlist, strength);
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39Validate(mnemonic, wordlist);
}

// Keep isValidMnemonic as an alias for backward compatibility with derive.test.ts
export function isValidMnemonic(mnemonic: string): boolean {
  return bip39Validate(mnemonic, wordlist);
}

export async function mnemonicToSeed(mnemonic: string): Promise<Buffer> {
  const bytes = await bip39Seed(mnemonic);
  return Buffer.from(bytes);
}
