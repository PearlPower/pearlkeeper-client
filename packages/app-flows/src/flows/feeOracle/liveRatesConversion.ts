// packages/app-flows/src/flows/feeOracle/liveRatesConversion.ts
//
// Boundary helper — convert the port-level `LiveRates` (number, matches
// wire / TanStack-cache-safe) to the send-flow internal `LiveRates`
// (BigInt, for sat-arithmetic in useSendFee).
//
// ( review): the TanStack cache holds `LiveRatesWithMeta`
// directly; storing BigInt rates inside it would block any future
// `persistQueryClient` wiring with "Do not know how to serialize a
// BigInt". Number at the port, BigInt at the consumer closes that gap
// without changing the send-flow's internal contract.

import type { LiveRates as PortLiveRates } from "@prl-wallet/services";
import type { LiveRates } from "../send/types.js";

export function liveRatesToBigInt(
  rates: PortLiveRates | null,
): LiveRates | null {
  if (!rates) return null;
  return {
    slow: BigInt(rates.slow),
    medium: BigInt(rates.medium),
    fast: BigInt(rates.fast),
  };
}
