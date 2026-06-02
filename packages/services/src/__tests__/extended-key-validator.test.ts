import { resolveNetworkContext } from "../network/resolveNetworkContext.js";
import {
  ExtendedKeyNetworkMismatchError,
  assertExtendedKeyMatchesNetwork,
  assertExtendedKeyMatchesPrefix,
} from "../address/extendedKeyValidator.js";

describe("CR-1 extended-key validator", () => {
  describe("assertExtendedKeyMatchesNetwork", () => {
    it("accepts a matching prefix for the configured network", () => {
      const btc = resolveNetworkContext("btc-mainnet");
      expect(() =>
        assertExtendedKeyMatchesNetwork(
          "xprv9s21ZrQH143K3example",
          btc,
          "private",
        ),
      ).not.toThrow();
      expect(() =>
        assertExtendedKeyMatchesNetwork(
          "xpubExampleStringForXpubPrefix",
          btc,
          "public",
        ),
      ).not.toThrow();
    });

    it("accepts either prefix when allow=both", () => {
      const btc = resolveNetworkContext("btc-mainnet");
      expect(() =>
        assertExtendedKeyMatchesNetwork("xprvWhatever", btc, "both"),
      ).not.toThrow();
      expect(() =>
        assertExtendedKeyMatchesNetwork("xpubWhatever", btc, "both"),
      ).not.toThrow();
    });

    it("rejects a testnet tpub being imported on mainnet xpub flow", () => {
      const btcMainnet = resolveNetworkContext("btc-mainnet");
      expect(() =>
        assertExtendedKeyMatchesNetwork(
          "tpubD6NzVbkrYhZ4WaY9CrossNetwork",
          btcMainnet,
          "public",
        ),
      ).toThrow(ExtendedKeyNetworkMismatchError);
    });

    it("rejects a legacy xprv being imported on a PRL (zprv-prefixed) network", () => {
      const prl = resolveNetworkContext("prl-mainnet");
      expect(() =>
        assertExtendedKeyMatchesNetwork(
          "xprvDifferentPrefixThanZprv",
          prl,
          "private",
        ),
      ).toThrow(/must start with "zprv"/);
    });

    it("error carries the expected/actual/network metadata for the UI", () => {
      const prlMainnet = resolveNetworkContext("prl-mainnet");
      try {
        assertExtendedKeyMatchesNetwork(
          "tpubLooksLikeATestnetPubKey",
          prlMainnet,
          "public",
        );
        fail("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(ExtendedKeyNetworkMismatchError);
        const e = err as ExtendedKeyNetworkMismatchError;
        expect(e.networkId).toBe("prl-mainnet");
        expect(e.expectedPrefix).toBe("zpub");
        expect(e.actualPrefix).toBe("tpub");
      }
    });

    it("private mode rejects a public-prefix key (xpub into private flow)", () => {
      const btc = resolveNetworkContext("btc-mainnet");
      expect(() =>
        assertExtendedKeyMatchesNetwork(
          "xpubIsNotPrivateOnTheXprvFlow",
          btc,
          "private",
        ),
      ).toThrow(ExtendedKeyNetworkMismatchError);
    });

    it("public mode rejects a private-prefix key (xprv into xpub flow)", () => {
      const btc = resolveNetworkContext("btc-mainnet");
      expect(() =>
        assertExtendedKeyMatchesNetwork(
          "xprvShouldNotPassXpubFlow",
          btc,
          "public",
        ),
      ).toThrow(ExtendedKeyNetworkMismatchError);
    });

    it("PRL testnet uses vprv/vpub prefixes (regression on derivation path)", () => {
      const prlTestnet = resolveNetworkContext("prl-testnet");
      expect(() =>
        assertExtendedKeyMatchesNetwork(
          "vprvExampleString",
          prlTestnet,
          "both",
        ),
      ).not.toThrow();
      expect(() =>
        assertExtendedKeyMatchesNetwork(
          "vpubExampleString",
          prlTestnet,
          "both",
        ),
      ).not.toThrow();
      expect(() =>
        assertExtendedKeyMatchesNetwork(
          "zprvForMainnetOnPrl",
          prlTestnet,
          "both",
        ),
      ).toThrow(ExtendedKeyNetworkMismatchError);
    });
  });

  describe("assertExtendedKeyMatchesPrefix (used by import flows)", () => {
    it("returns silently for a matching private prefix", () => {
      expect(() =>
        assertExtendedKeyMatchesPrefix("xprvExampleString", {
          networkId: "btc-mainnet",
          extendedKeyPrefix: "xprv",
          extendedPubKeyPrefix: "xpub",
          allow: "private",
        }),
      ).not.toThrow();
    });

    it("rejects mismatched prefix with metadata-bearing error", () => {
      expect(() =>
        assertExtendedKeyMatchesPrefix("tprvCrossNetworkPrivateKey", {
          networkId: "btc-mainnet",
          extendedKeyPrefix: "xprv",
          extendedPubKeyPrefix: "xpub",
          allow: "private",
        }),
      ).toThrow(/must start with "xprv"/);
    });
  });
});
