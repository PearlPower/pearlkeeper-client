import { useEffect, useState } from "react";
import type { AddressService } from "@prl-wallet/services";
import type { WalletType } from "@prl-wallet/app-state";
import { useAdapters } from "@prl-wallet/app-adapters";
import { type LiveRates, TIER_BLOCKS } from "./types.js";
import {
  type SigningWalletReference,
  toSigningWalletReference,
} from "./sendUtils.js";

type WalletIdentity = {
  id: string;
  networkId: string;
};

export type SendFlowInitResult = {
  walletType: WalletType | null;
  walletAddresses: string[];
  changeAddress: string | null;
  signingWallet: SigningWalletReference | null;
  isInitializing: boolean;
  initError: string | null;
  liveRates: LiveRates | null;
  loadingRates: boolean;
};

export function useSendFlowInit(
  wallet: WalletIdentity | null,
  addressService: AddressService,
): SendFlowInitResult {
  const { services } = useAdapters();

  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [walletAddresses, setWalletAddresses] = useState<string[]>([]);
  const [changeAddress, setChangeAddress] = useState<string | null>(null);
  const [signingWallet, setSigningWallet] =
    useState<SigningWalletReference | null>(null);
  const [isInitializing, setIsInitializing] = useState(Boolean(wallet));
  const [initError, setInitError] = useState<string | null>(null);
  const [liveRates, setLiveRates] = useState<LiveRates | null>(null);
  const [loadingRates, setLoadingRates] = useState(Boolean(wallet));

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (!wallet) {
        setIsInitializing(false);
        setLoadingRates(false);
        setInitError("No active wallet");
        return;
      }

      setIsInitializing(true);
      setInitError(null);

      try {
        // PORT CHANGE: was `getWalletType(wallet.id)` from mobile secureStorage
        const type = await services.secrets.getWalletType(wallet.id);
        if (cancelled) return;

        if (!type) {
          setInitError("Wallet type not found");
          setIsInitializing(false);
          setLoadingRates(false);
          return;
        }

        setWalletType(type);

        if (type === "xpub") {
          setIsInitializing(false);
          setLoadingRates(false);
          return;
        }

        const signingRef = toSigningWalletReference(wallet, type);
        const discovery = await addressService.discoverAddresses({
          wallet: signingRef,
        });

        if (cancelled) return;

        setSigningWallet(signingRef);
        setWalletAddresses(discovery.derivedAddresses.map((d) => d.address));
        setChangeAddress(discovery.receiveAddress);
      } catch (error) {
        if (!cancelled) {
          setInitError(
            error instanceof Error ? error.message : "Unable to prepare wallet",
          );
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    }

    async function loadFeeRates() {
      if (!wallet) {
        setLoadingRates(false);
        return;
      }

      setLoadingRates(true);
      try {
        // PORT CHANGE: was `getBlockbookClient(wallet.networkId).estimateFee(...)`
        const client = services.blockbook(wallet.networkId);
        const [slow, medium, fast] = await Promise.all([
          client.estimateFee(TIER_BLOCKS.slow),
          client.estimateFee(TIER_BLOCKS.medium),
          client.estimateFee(TIER_BLOCKS.fast),
        ]);

        if (!cancelled) {
          setLiveRates({
            slow: BigInt(slow),
            medium: BigInt(medium),
            fast: BigInt(fast),
          });
        }
      } catch {
        if (!cancelled) {
          setLiveRates(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingRates(false);
        }
      }
    }

    void initialize();
    void loadFeeRates();

    return () => {
      cancelled = true;
    };
  }, [addressService, services, wallet]);

  return {
    walletType,
    walletAddresses,
    changeAddress,
    signingWallet,
    isInitializing,
    initError,
    liveRates,
    loadingRates,
  };
}
