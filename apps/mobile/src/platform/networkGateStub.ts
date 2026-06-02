import type { NetworkGatePort } from "@prl-wallet/app-adapters";

/**
 * Always-open mobile stub for NetworkGatePort (). Mobile never gates
 * network access — the real gate lives on desktop (). The stub
 * returns `true` for isOpen() and registers no-op listeners so the shared
 * BlockbookClient + useGatedQuery wrappers behave as always-online on RN.
 */
export const networkGateStub: NetworkGatePort = {
  isOpen: () => true,
  subscribe: () => () => {},
};
