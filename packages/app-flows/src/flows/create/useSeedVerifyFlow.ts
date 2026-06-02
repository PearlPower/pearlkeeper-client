import { useCallback, useState } from "react";
import { wordlist } from "@scure/bip39/wordlists/english";
import { deriveP2TRAddress, secureRandomInt } from "@prl-wallet/core";
import type { ServicesPorts } from "@prl-wallet/services";
import type { Network } from "bitcoinjs-lib";
import type { ImportWalletType } from "./types.js";

interface BlankItem {
  position: number;
  choices: string[];
  correct: string;
}

export interface Challenge {
  blanks: BlankItem[];
}

// CR-2: every pick in this function MUST come from a CSPRNG. A predictable
// challenge defeats the seed-verify screen — an attacker who can sample
// `Math.random()` after a known seed-time knows which 4 positions matter
// and can prefill/autosuggest exactly those words.
export function generateChallenge(words: string[]): Challenge {
  const positions: number[] = [];
  while (positions.length < 4) {
    const candidate = secureRandomInt(words.length);
    if (!positions.includes(candidate)) {
      positions.push(candidate);
    }
  }
  positions.sort((a, b) => a - b);

  const blanks: BlankItem[] = positions.map((pos) => {
    const correct = words[pos];
    const pool: string[] = [correct];
    const wordsToAvoid = new Set(words);
    while (pool.length < 4) {
      const candidate = wordlist[secureRandomInt(wordlist.length)];
      if (!pool.includes(candidate) && !wordsToAvoid.has(candidate)) {
        pool.push(candidate);
      }
    }
    // Fisher-Yates shuffle with CSPRNG-sourced indices.
    for (let i = pool.length - 1; i > 0; i-) {
      const j = secureRandomInt(i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { position: pos, choices: pool, correct };
  });

  return { blanks };
}

type WalletNameNavigation = {
  goToWalletName: (
    walletId: string,
    address: string,
    walletType: ImportWalletType,
  ) => void;
};

type UseSeedVerifyFlowArgs = {
  navigation: WalletNameNavigation;
  mnemonic: string;
  ports: ServicesPorts;
  network: Network;
  bip86Path: (account?: number, change?: number, index?: number) => string;
  networkId: string;
};

export type SeedVerifyFlowResult = {
  challenge: Challenge;
  selections: Record<number, string>;
  error: string | null;
  isVerifying: boolean;
  allSelected: boolean;
  handleSelect: (position: number, word: string) => void;
  handleVerify: () => Promise<void>;
};

export function useSeedVerifyFlow({
  navigation,
  mnemonic,
  ports,
  network,
  bip86Path,
  networkId: _networkId,
}: UseSeedVerifyFlowArgs): SeedVerifyFlowResult {
  const words = mnemonic.split(" ");

  const [challenge, setChallenge] = useState<Challenge>(() =>
    generateChallenge(words),
  );
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const triggerNewChallenge = useCallback(() => {
    setChallenge(generateChallenge(words));
    setSelections({});
  }, [words]);

  const handleSelect = useCallback((position: number, word: string) => {
    setSelections((prev) => ({ ...prev, [position]: word }));
  }, []);

  const allSelected = challenge.blanks.every(
    (b) => selections[b.position] !== undefined,
  );

  const handleVerify = async () => {
    if (!allSelected || isVerifying) return;

    const allCorrect = challenge.blanks.every(
      (b) => selections[b.position] === b.correct,
    );

    if (!allCorrect) {
      setError("Incorrect — please try again.");
      triggerNewChallenge();
      return;
    }

    setIsVerifying(true);
    let walletId: string | null = null;
    try {
      const result = await deriveP2TRAddress(mnemonic, network, bip86Path);
      setError(null);
      walletId = ports.runtime.createId();
      await ports.secrets.storeMnemonic(walletId, mnemonic);
      await ports.secrets.storeWalletType(walletId, "mnemonic");
      navigation.goToWalletName(walletId, result.address, "mnemonic");
    } catch (_err) {
      // Roll back partially-stored secrets so the user does not accumulate
      // orphaned Keychain entries on iOS retries (see review WR-04).
      if (walletId) {
        await ports.secrets
          .deleteWalletSecrets(walletId)
          .catch(() => undefined);
      }
      setError("Failed to derive address — please try again");
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    challenge,
    selections,
    error,
    isVerifying,
    allSelected,
    handleSelect,
    handleVerify,
  };
}
