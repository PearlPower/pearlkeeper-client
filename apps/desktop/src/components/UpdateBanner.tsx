// apps/desktop/src/components/UpdateBanner.tsx
//
// Unified update panel — desktop half. Composes the platform-neutral
// `useUpdateBanner` hook with desktop-specific glue:
// installedVersion comes from Tauri's `getVersion()` (async, hence the
// bootstrap `useEffect`).
// "Update Now" hands off to the existing `installAndRestart()` flow
// (download + verify minisign + in-place install + relaunch) in
// ../lib/updater.ts.
// The silent StatusBar `UpdateIndicator` stays mounted as a secondary
// touchpoint — users who dismiss the panel still see it in the chrome.
//
// Modal renders only when `useUpdateBanner` returns "nudge" or "forced":
// nudge: dismissable (caches dismissedVersion in localStorage)
// forced: not dismissable; Update Now is the only action
//
// Markdown changelog is rendered with `react-markdown` — small enough that a
// dedicated library beats a roll-your-own renderer for our changelog needs.

import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import ReactMarkdown from "react-markdown";
import { useUpdateBanner } from "@prl-wallet/app-flows";
import { useAdapters } from "@prl-wallet/app-adapters";
import { installAndRestart } from "@/lib/updater";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DISMISSED_VERSION_KEY = "update-banner:dismissedVersion";

async function getDismissedVersion(): Promise<string | null> {
  return window.localStorage.getItem(DISMISSED_VERSION_KEY);
}

async function setDismissedVersion(v: string): Promise<void> {
  window.localStorage.setItem(DISMISSED_VERSION_KEY, v);
}

export function UpdateBanner(): React.ReactElement | null {
  const { services } = useAdapters();
  const signedConfigPort = services.signedConfig;
  const releasesPort = services.releases;

  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then((v) => {
        if (!cancelled) setInstalledVersion(v);
      })
      .catch(() => {
        // Tauri shouldn't fail here in production; failure leaves the panel
        // dormant rather than crashing the app.
        if (!cancelled) setInstalledVersion("0.0.0");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Memoize so the hook's internal effect sees a stable identity. Same
  // rationale as the mobile half — guards against future eslint-deps
  // tightening on useUpdateBanner.
  const getChangelog = useMemo(
    () =>
      releasesPort
        ? async (currentVersion: string): Promise<string> => {
            const { releases } =
              await releasesPort.getReleasesSince(currentVersion);
            return releases.map((r) => r.changelog).join("\n\n---\n\n");
          }
        : undefined,
    [releasesPort],
  );

  const banner = useUpdateBanner(
    // useUpdateBanner requires a non-null port; guard with a no-op when
    // tests pass an undefined adapters bundle.
    signedConfigPort ?? noopSignedConfigPort,
    {
      installedVersion: installedVersion ?? "0.0.0",
      getDismissedVersion,
      setDismissedVersion,
      getChangelog,
    },
  );

  if (!signedConfigPort) return null;
  if (!installedVersion) return null;
  if (banner.state === "hidden") return null;

  const isForced = banner.state === "forced";

  const onUpdate = async () => {
    await installAndRestart({});
  };

  const onLater = async () => {
    if (isForced) return; // forced state: dismiss is not a valid action
    await banner.dismiss();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isForced) {
          void banner.dismiss();
        }
      }}
    >
      <DialogContent
        showCloseButton={!isForced}
        onEscapeKeyDown={(e) => {
          if (isForced) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (isForced) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Update Available — v{banner.latestVersion}</DialogTitle>
          <DialogDescription>
            {isForced
              ? "This version of Pearl Keeper is no longer supported. Please install the update to continue."
              : "A new version of Pearl Keeper is available."}
          </DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm max-h-80 overflow-y-auto py-2 dark:prose-invert">
          {banner.changelog ? (
            <ReactMarkdown>{banner.changelog}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground text-sm">
              Click <strong>Update Now</strong> to install and restart.
            </p>
          )}
        </div>
        <DialogFooter>
          {!isForced ? (
            <Button variant="ghost" onClick={onLater}>
              Later
            </Button>
          ) : null}
          <Button onClick={onUpdate}>Update Now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Fallback for tests that mount UpdateBanner without a signedConfig port
// wired into the adapters bundle. Treated as "loading" by the hook.
const noopSignedConfigPort = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getChainConfig: (async () => null) as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getVersionManifest: (async () => null) as any,
};
