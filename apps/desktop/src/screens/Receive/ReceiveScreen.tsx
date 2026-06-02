// apps/desktop/src/screens/Receive/ReceiveScreen.tsx
// TX-01. (QRCodeCanvas), (CopyButton + copyLabel timer),
// (Save QR as PNG via Tauri dialog.save + fs.writeFile — native save-as
// picker + Downloads-scoped writes, with toast confirmation and busy state),
// (Generate-another link with explanatory copy).
// Container chrome follows desktop convention: <main bg-background min-h-screen>
// > <section max-w-md mx-auto px-6 py-8 pb-12>.

import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "zustand";
import { QRCodeCanvas } from "qrcode.react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useReceiveFlow } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/CopyButton";

export function ReceiveScreen() {
  const { id: walletId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { stores } = useAdapters();
  const [isSavingPng, setIsSavingPng] = useState(false);

  // Read the wallet's networkId from the walletList store so the
  // PNG filename can include it (UI-SPEC locked filename format).
  const networkId = useStore(
    stores.walletList,
    (s) => s.wallets.find((w) => w.id === walletId)?.networkId ?? "unknown",
  );

  const {
    receiveAddress,
    copyAddress,
    copyLabel,
    generateAnotherAddress,
    isGeneratingAnother,
    isLoading,
  } = useReceiveFlow({
    walletId: walletId ?? "",
    navigation: { goBack: () => navigate(1) },
  });

  async function onSavePng() {
    if (!canvasRef.current || !receiveAddress) return;
    const slugId = networkId.replace(/[^a-zA-Z0-9-]/g, "");
    const slugAddr = receiveAddress.slice(0, 6);
    const defaultFilename = `prl-receive-address-${slugId}-${slugAddr}.png`;

    // 1) Native save-as dialog (Tauri) — user picks the location + filename.
    let targetPath: string | null = null;
    try {
      targetPath = await save({
        title: "Save receive QR as PNG",
        defaultPath: defaultFilename,
        filters: [{ name: "PNG image", extensions: ["png"] }],
      });
    } catch (err) {
      console.error("[receive] save dialog error", err);
      toast.error("Could not open save dialog");
      return;
    }
    if (!targetPath) {
      // User cancelled — silent, no error.
      return;
    }

    // 2) Encode canvas → PNG bytes.
    setIsSavingPng(true);
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        canvasRef.current!.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("canvas.toBlob returned null");
      const bytes = new Uint8Array(await blob.arrayBuffer());

      // 3) Write to user-chosen path via Tauri fs plugin.
      await writeFile(targetPath, bytes);

      toast.success("QR saved as PNG", {
        description: targetPath,
      });
    } catch (err) {
      console.error("[receive] save png error", err);
      toast.error("Could not save QR as PNG", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSavingPng(false);
    }
  }

  return (
    <main className="bg-background min-h-screen">
      <section className="max-w-md mx-auto px-6 py-8 pb-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(1)}
          aria-label="Back"
          className="mb-4"
        >
          ← Back
        </Button>

        <h1 className="text-xl font-semibold leading-snug text-center mb-6">
          Receive
        </h1>

        <Card className="p-6 flex flex-col items-center gap-6">
          {/* QR-frame exception: bg-white is hardcoded per UI-SPEC §"QR-frame exception" */}
          <div className="bg-white p-8 rounded-md">
            {isLoading && !receiveAddress ? (
              <div
                className="flex items-center justify-center"
                style={{ width: 256, height: 256 }}
              >
                <p className="text-sm text-muted-foreground text-center">
                  Generating your address...
                </p>
              </div>
            ) : (
              <div
                role="img"
                aria-label="QR code containing your receive address"
              >
                <QRCodeCanvas
                  ref={canvasRef}
                  value={receiveAddress ?? ""}
                  size={256}
                  level="M"
                  marginSize={4}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
            )}
          </div>

          <p className="font-mono text-sm leading-normal break-all w-full text-center">
            {receiveAddress ?? "—"}
          </p>

          <div className="flex gap-3 w-full">
            <CopyButton
              onCopy={copyAddress}
              label={copyLabel}
              className="flex-1"
            />
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => void onSavePng()}
              disabled={!receiveAddress || isSavingPng}
            >
              {isSavingPng ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving...
                </>
              ) : (
                "Save QR as PNG"
              )}
            </Button>
          </div>
        </Card>

        <Separator className="my-8" />

        {/* : Generate-another section */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Need a fresh address?
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            The current address is valid and has not been used before. Generate
            a new receive address only if you want better privacy by separating
            future deposits.
          </p>
          <button
            type="button"
            aria-label="Generate a new receive address"
            className="text-primary text-sm hover:underline disabled:opacity-50"
            disabled={isGeneratingAnother}
            onClick={() => void generateAnotherAddress()}
          >
            {isGeneratingAnother ? (
              <>
                <Loader2 className="size-4 animate-spin inline mr-1" />
                Generating...
              </>
            ) : (
              "Generate a new receive address"
            )}
          </button>
        </div>
      </section>
    </main>
  );
}
