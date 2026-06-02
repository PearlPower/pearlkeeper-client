// apps/desktop/src/screens/Send/SendSuccessScreen.tsx
// TX-02. Terminal success screen: TXID display + CopyButton +
// conditional explorer link (BTC only) + dual CTAs.
// T-21-06-EMPTY-SUCCESS: redirects to /wallet/:id when txid is null.
// T-21-06-EXPLORER-LINK-DRIFT: networkId switch produces null for non-BTC.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { Check, ExternalLink } from "lucide-react";
import { useAdapters } from "@prl-wallet/app-adapters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import { explorerUrl as buildExplorerUrl } from "@/lib/explorerUrl";
import { useSendFlow } from "./SendFlowProvider";

export function SendSuccessScreen() {
  const navigate = useNavigate();
  const { stores, ports } = useAdapters();
  const { txid, walletId, analyticsFlow } = useSendFlow();

  // Read networkId from walletList store so we can compute the explorer URL.
  const networkId = useStore(
    stores.walletList,
    (s) => s.wallets.find((w) => w.id === walletId)?.networkId ?? "",
  );

  // T-21-06-EMPTY-SUCCESS: redirect when txid is null (user navigated here
  // directly without broadcasting — prevents an empty success view).
  useEffect(() => {
    if (!txid) navigate(`/wallet/${walletId}`, { replace: true });
  }, [txid, navigate, walletId]);

  // flow.success on the success screen reaching with a
  // txid. One-shot: SendFlowProvider's startedAtRef supplies the duration
  // metric and the success event itself fires exactly once per ceremony.
  const successEmittedRef = useRef(false);
  useEffect(() => {
    if (successEmittedRef.current) return;
    if (txid) {
      successEmittedRef.current = true;
      analyticsFlow.success();
    }
  }, [txid, analyticsFlow]);

  const explorerUrl = txid ? buildExplorerUrl(networkId, txid) : null;

  // TXID copy logic — 1.5s label flip (CopyButton is consumer-driven per ).
  const [copyLabel, setCopyLabel] = useState<"Copy" | "Copied!">("Copy");
  const onCopyTxid = useCallback(async () => {
    if (!txid) return;
    await ports.clipboard.setString(txid);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy"), 1500);
  }, [txid, ports]);

  // While txid is null the redirect effect fires — render nothing meanwhile.
  if (!txid) return null;

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8 pb-12 text-center">
        <Check className="text-primary mx-auto" size={56} />
        <h1 className="text-xl font-semibold mt-6">Transaction sent</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {"It's on its way to the network."}
        </p>

        <Card className="p-6 mt-8 text-left">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            TRANSACTION ID
          </p>
          <p className="font-mono text-sm leading-normal break-all mt-2">
            {txid}
          </p>
          <div className="flex justify-end mt-4">
            <CopyButton onCopy={onCopyTxid} label={copyLabel} />
          </div>
        </Card>

        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-sm hover:underline inline-flex items-center gap-1 mt-6"
          >
            View on explorer <ExternalLink className="size-3" />
          </a>
        )}

        <div className="flex justify-between mt-8 gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() =>
              navigate(`/wallet/${walletId}/send/address`, { replace: true })
            }
          >
            Send another
          </Button>
          <Button
            className="flex-1"
            onClick={() => navigate(`/wallet/${walletId}`)}
          >
            Done
          </Button>
        </div>
      </section>
    </main>
  );
}
