import { useCallback, useState } from "react";
import type { Network } from "bitcoinjs-lib";
import { validateRecipientAddress } from "./sendHelpers.js";
import { parseQRData } from "./sendUtils.js";

type UseSendAddressArgs = {
  walletNetwork: Network | null;
  bip21Prefix: string;
  invalidAddressMessage: string;
  isWatchOnly: boolean;
  onScanRequested: () => Promise<boolean>;
  onInvalidScan: (title: string, body: string) => void;
};

export type SendAddressResult = {
  recipientAddress: string;
  setRecipientAddress: (value: string) => void;
  addressError: string | null;
  validateAddress: () => boolean;
  scannerVisible: boolean;
  openScanner: () => Promise<void>;
  closeScanner: () => void;
  handleQRScanned: (event: { data: string }) => void;
  scanned: boolean;
};

export function useSendAddress({
  walletNetwork,
  bip21Prefix,
  invalidAddressMessage,
  isWatchOnly,
  onScanRequested,
  onInvalidScan,
}: UseSendAddressArgs): SendAddressResult {
  const [recipientAddress, setRecipientAddressRaw] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  const setRecipientAddress = useCallback((value: string) => {
    setRecipientAddressRaw(value);
    setAddressError(null);
  }, []);

  const openScanner = useCallback(async () => {
    const granted = await onScanRequested();
    if (!granted) {
      onInvalidScan(
        "Camera permission required",
        "Please enable camera access in Settings to scan QR codes.",
      );
      return;
    }
    setScanned(false);
    setScannerVisible(true);
  }, [onInvalidScan, onScanRequested]);

  const closeScanner = useCallback(() => {
    setScannerVisible(false);
  }, []);

  const handleQRScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;

      setScanned(true);
      setScannerVisible(false);

      const parsedAddress = parseQRData(data, bip21Prefix);
      setRecipientAddressRaw(parsedAddress);

      if (!validateRecipientAddress(parsedAddress, walletNetwork)) {
        setAddressError(invalidAddressMessage);
        return;
      }
      setAddressError(null);
    },
    [bip21Prefix, invalidAddressMessage, scanned, walletNetwork],
  );

  const validateAddress = useCallback((): boolean => {
    if (isWatchOnly) return false;

    const trimmed = recipientAddress.trim();
    if (!validateRecipientAddress(trimmed, walletNetwork)) {
      setAddressError(invalidAddressMessage);
      return false;
    }

    setAddressError(null);
    setRecipientAddressRaw(trimmed);
    return true;
  }, [invalidAddressMessage, isWatchOnly, recipientAddress, walletNetwork]);

  return {
    recipientAddress,
    setRecipientAddress,
    addressError,
    validateAddress,
    scannerVisible,
    openScanner,
    closeScanner,
    handleQRScanned,
    scanned,
  };
}
