// apps/desktop/src/screens/Send/SendAddressScreen.tsx
// RHF + zod address form (, paste-only, TX-05 no QR).
// BIP21 paste handling: onChange parses the raw input via parseQRData;
// if a BIP21 URI is detected, strips the prefix, pre-fills amount via Provider,
// and shows a 3-second ephemeral hint. No media-input UI per TX-05 + .

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getNetworkMetadata,
  parseBip21Uri,
  parsePrlToSats,
  selectSendWallet,
} from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { BLOCKCHAINS } from "@prl-wallet/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { satoshisToDisplay } from "@/lib/satoshisToDisplay";
import { useSendFlow } from "./SendFlowProvider";
import { addressSchema } from "./schemas";

export function SendAddressScreen() {
  const navigate = useNavigate();
  const { stores } = useAdapters();
  const flow = useSendFlow();

  // tx.send funnel start trigger lives at the first
  // wizard screen mount. The hook is hoisted to SendFlowProvider so
  // startedAtRef is shared across all 5 screens; this useEffect just
  // emits flow.start exactly once per provider mount.
  const flowStartEmittedRef = useRef(false);
  useEffect(() => {
    if (flowStartEmittedRef.current) return;
    flowStartEmittedRef.current = true;
    flow.analyticsFlow.start();
  }, [flow.analyticsFlow]);

  const wallet = useStore(stores.walletList, (s) =>
    selectSendWallet(s.wallets, flow.walletId),
  );

  const networkMeta = wallet ? getNetworkMetadata(wallet.networkId) : null;
  const walletNetwork = networkMeta?.network ?? null;
  const bip21Prefix = networkMeta?.bip21Prefix ?? "";
  const bech32Hrp = networkMeta?.bech32Hrp ?? "";
  const chainName = networkMeta?.blockchainLabel ?? "";

  // Derive chainSymbol from BLOCKCHAINS config
  const chainSymbol =
    BLOCKCHAINS.flatMap((bc) => bc.networks).find(
      (n) => n.id === wallet?.networkId,
    )?.symbol ?? "";

  const [pastedAmountHint, setPastedAmountHint] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(addressSchema(walletNetwork)),
    defaultValues: { address: flow.recipientAddress },
  });

  const onSubmit = handleSubmit((values) => {
    flow.setRecipientAddress(values.address.trim());
    // address validated + persisted = tx.send step.
    flow.analyticsFlow.step("address.entered");
    navigate(`/wallet/${flow.walletId}/send/amount`);
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const bip21 = parseBip21Uri(raw, bip21Prefix);
    if (bip21) {
      // BIP21 URI detected — strip to bare address
      setValue("address", bip21.address, { shouldValidate: true });
      if (bip21.amount) {
        const sats = parsePrlToSats(bip21.amount);
        if (sats !== null) {
          flow.setAmountSats(sats);
          // Display: sats → display string
          const displayAmt = satoshisToDisplay(
            sats.toString(),
          );
          setPastedAmountHint(`${displayAmt} ${chainSymbol}`);
          if (dismissTimerRef.current)
            clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = setTimeout(() => {
            setPastedAmountHint(null);
          }, 3000);
        }
      }
    }
    // If not BIP21, RHF's register onChange handles the raw value natively
  };

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8 pb-12">
        <h1 className="text-xl font-semibold leading-snug mb-6">
          Send {chainName}
        </h1>
        <form onSubmit={onSubmit}>
          <Label
            htmlFor="send-address-input"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Recipient address
          </Label>
          <Input
            id="send-address-input"
            {...register("address", { onChange: handleChange })}
            autoFocus
            placeholder={
              bech32Hrp ? `${bech32Hrp}1...` : "address"
            }
            className="mt-2 h-10 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Paste a {chainName} address. BIP21 URIs are supported.
          </p>
          {errors.address && (
            <p className="text-sm text-destructive mt-3" role="alert">
              {errors.address.message}
            </p>
          )}
          {pastedAmountHint && (
            <p className="text-xs text-muted-foreground mt-2">
              Pasted amount: {pastedAmountHint}.
            </p>
          )}
          <div className="flex justify-end mt-6">
            <Button type="submit" size="default">
              Next
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
