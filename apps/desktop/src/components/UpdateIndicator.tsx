// apps/desktop/src/components/UpdateIndicator.tsx
// , — StatusBar update slot.
//
// Four states:
// hidden: no update detected → renders null
// "Update available" → click triggers download flow
// "Downloading {N}%" → progress bar text
// "Restart to update" → click triggers relaunch
//
// Locked copy from UI-SPEC §Components — DO NOT paraphrase.

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import {
  checkForUpdate,
  installAndRestart,
  type UpdaterState,
} from "@/lib/updater";
import { cn } from "@/lib/utils";

export function UpdateIndicator() {
  const [state, setState] = useState<UpdaterState>({ kind: "idle" });

  useEffect(() => {
    checkForUpdate().then(setState);
  }, []);

  if (state.kind === "idle") return null;

  const onClick = async () => {
    if (state.kind === "available") {
      setState({ kind: "downloading", percent: 0 });
      try {
        await installAndRestart({
          onProgress: (percent) => setState({ kind: "downloading", percent }),
        });
        setState({ kind: "ready" });
      } catch {
        // mapInstallError already surfaced a dialog; reset so the user can retry.
        setState({ kind: "idle" });
      }
    }
  };

  const label =
    state.kind === "available"
      ? "Update available"
      : state.kind === "downloading"
        ? `Downloading ${state.percent}%`
        : "Restart to update";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-sm text-xs",
        "text-muted-foreground hover:text-foreground transition-colors",
      )}
      aria-label={label}
    >
      <ArrowUp className="size-3" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
