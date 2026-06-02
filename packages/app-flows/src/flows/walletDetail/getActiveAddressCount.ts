// packages/app-flows/src/flows/walletDetail/getActiveAddressCount.ts
// canonical "active address" count util. The
// useWalletDetailFlow.ts:107-112 lastUsedIndex+1 definition is dropped
// in favor of the filter definition AddressList already uses. Both
// screens now consume this util (drift-prevention).
//
// Type note: the plan referenced `DerivedAddressInfo` from
// `packages/services/src/types/walletAddress.ts`. The actual exported
// type in @prl-wallet/services is `DerivedAddress`
// (packages/services/src/contracts/address.ts) — same shape with
// `hasTransactions: boolean`. We import the real symbol.

import type { DerivedAddress } from "@prl-wallet/services";

export function getActiveAddressCount(
  addresses: ReadonlyArray<DerivedAddress>,
): number {
  return addresses.filter((a) => a.hasTransactions).length;
}
