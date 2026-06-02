import { useMemo } from "react";
import {
  createAddressService,
  createTransactionService,
  createWalletService,
} from "@prl-wallet/services";
import { useAdapters } from "@prl-wallet/app-adapters";

/**
 * Memoized wrapper that pulls the ServicesPorts bundle from
 * `useAdapters().services` and constructs the three service objects on top.
 * Consumers read `ports`, `walletService`, `addressService`, and
 * `transactionService` as before — platform port construction stays in the
 * mobile AdaptersProvider (Pitfall 10: no ServicesPorts factory lives here).
 */
export function useWalletServices() {
  const { services } = useAdapters();
  return useMemo(
    () => ({
      ports: services,
      walletService: createWalletService(services),
      addressService: createAddressService(services),
      transactionService: createTransactionService(services),
    }),
    [services],
  );
}
