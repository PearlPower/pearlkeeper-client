import { useCallback, useState } from "react";
import { satoshisToPrl } from "@prl-wallet/api-client";

const SATS_PER_PRL = 100_000_000n;
const PRL_DECIMALS = 8;

// Parse a decimal PRL amount string ("1.23") into satoshis using bigint
// math throughout — never converts via Number, so precision is exact for
// any value the UI can display, regardless of supply cap. Returns null
// for malformed input so the caller can fall back to zero.
export function parsePrlToSats(text: string): bigint | null {
  if (!/^\d+(\.\d*)?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const fracPadded = (frac + "0".repeat(PRL_DECIMALS)).slice(0, PRL_DECIMALS);
  return BigInt(whole || "0") * SATS_PER_PRL + BigInt(fracPadded || "0");
}

export type SendAmountResult = {
  amountSats: bigint;
  amountText: string;
  handleAmountTextChange: (text: string) => void;
  handleSliderChange: (value: number) => void;
  sliderPercent: number;
  spendableDisplay: string;
  amountError: string | null;
  validateAmount: () => boolean;
};

export function useSendAmount(confirmedBalance: bigint): SendAmountResult {
  const [amountSats, setAmountSats] = useState<bigint>(0n);
  const [amountError, setAmountError] = useState<string | null>(null);

  const handleAmountTextChange = useCallback((text: string) => {
    setAmountError(null);

    if (text === "" || text === "0") {
      setAmountSats(0n);
      return;
    }

    const sats = parsePrlToSats(text);
    if (sats === null) {
      setAmountSats(0n);
      return;
    }

    setAmountSats(sats);
  }, []);

  const handleSliderChange = useCallback(
    (value: number) => {
      setAmountError(null);
      if (confirmedBalance <= 0n) return;
      setAmountSats(
        BigInt(Math.round((value / 100) * Number(confirmedBalance))),
      );
    },
    [confirmedBalance],
  );

  const amountText =
    amountSats === 0n ? "" : satoshisToPrl(amountSats.toString());
  const sliderPercent =
    confirmedBalance > 0n
      ? Math.min(100, (Number(amountSats) / Number(confirmedBalance)) * 100)
      : 0;
  const spendableDisplay = `${satoshisToPrl(confirmedBalance.toString())} PRL`;

  const validateAmount = useCallback((): boolean => {
    if (amountSats <= 0n) {
      setAmountError("Amount must be greater than zero.");
      return false;
    }
    if (amountSats > confirmedBalance) {
      setAmountError("Amount exceeds your balance.");
      return false;
    }
    setAmountError(null);
    return true;
  }, [amountSats, confirmedBalance]);

  return {
    amountSats,
    amountText,
    handleAmountTextChange,
    handleSliderChange,
    sliderPercent,
    spendableDisplay,
    amountError,
    validateAmount,
  };
}
