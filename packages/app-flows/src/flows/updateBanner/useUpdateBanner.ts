// packages/app-flows/src/flows/updateBanner/useUpdateBanner.ts
//
// Unified update-panel hook composing useSignedConfig over `version-manifest`
// with an optional changelog fetch. Returns a discriminated `state`:
// "forced" when installedVersion < minSupportedVersion
// "nudge" when installedVersion < latestVersion AND dismissedVersion < latest
// "hidden" otherwise (incl. loading and error)
//
// Platform-neutral: the result exposes every URL from the version-manifest
// payload (iOS App Store, Android Play, Android APK side-load, desktop Tauri
// auto-updater endpoint). The consuming UI picks which buttons to render.
//
// Dismissal storage is delegated via callbacks so the hook stays platform-
// neutral; mobile passes AsyncStorage-backed callbacks, desktop passes
// localStorage-backed ones.

import { useEffect, useState } from "react";
import semverCompare from "semver-compare";
import type { SignedConfigPort } from "@prl-wallet/services";
import { useSignedConfig } from "../signedConfig/useSignedConfig.js";
import type {
  BannerState,
  UpdateBannerResult,
  UseUpdateBannerArgs,
} from "./UpdateBanner.types.js";

export function computeBannerState(args: {
  installedVersion: string;
  latestVersion: string;
  minSupportedVersion: string;
  dismissedVersion: string | null;
}): BannerState {
  const {
    installedVersion,
    latestVersion,
    minSupportedVersion,
    dismissedVersion,
  } = args;
  if (semverCompare(installedVersion, minSupportedVersion) < 0) return "forced";
  if (
    semverCompare(installedVersion, latestVersion) < 0 &&
    (!dismissedVersion || semverCompare(dismissedVersion, latestVersion) < 0)
  ) {
    return "nudge";
  }
  return "hidden";
}

const EMPTY_RESULT: UpdateBannerResult = {
  state: "hidden",
  latestVersion: "",
  minSupportedVersion: "",
  changelog: "",
  dismiss: async () => {},
};

export function useUpdateBanner(
  port: SignedConfigPort,
  args: UseUpdateBannerArgs,
): UpdateBannerResult {
  const result = useSignedConfig(port, "version-manifest");
  const [dismissedVersion, setDismissedVersionState] = useState<string | null>(
    null,
  );
  const [storageReady, setStorageReady] = useState(false);
  const [changelog, setChangelog] = useState<string>("");

  // Read dismissed version from storage once on mount. Inline-constructed
  // `args` objects would re-fire this effect on every render and clobber
  // post-dismiss state, so the dep array intentionally stays empty.
  useEffect(() => {
    let cancelled = false;
    args
      .getDismissedVersion()
      .then((v) => {
        if (cancelled) return;
        setDismissedVersionState(v ?? null);
        setStorageReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setStorageReady(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute current state once the manifest + dismissal state are resolved.
  const manifest = result.data;
  const state: BannerState =
    !manifest || result.isLoading || result.isError || !storageReady
      ? "hidden"
      : computeBannerState({
          installedVersion: args.installedVersion,
          latestVersion: manifest.latestVersion,
          minSupportedVersion: manifest.minSupportedVersion,
          dismissedVersion,
        });

  // Fetch the concatenated changelog only when the panel will render. Avoids
  // the network round-trip for the common "no update" case. Re-fires when
  // installedVersion changes (uninstall/reinstall) so the diff stays right.
  useEffect(() => {
    if (state === "hidden") return;
    const fetcher = args.getChangelog;
    if (!fetcher) return;
    let cancelled = false;
    fetcher(args.installedVersion)
      .then((md) => {
        if (cancelled) return;
        setChangelog(md);
      })
      .catch(() => {
        // Swallow — panel still renders with empty changelog; the install
        // buttons remain reachable. Editorial content is not load-bearing.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, args.installedVersion]);

  if (!manifest || result.isLoading || result.isError || !storageReady) {
    return EMPTY_RESULT;
  }

  const dismiss = async () => {
    await args.setDismissedVersion(manifest.latestVersion);
    setDismissedVersionState(manifest.latestVersion);
  };
  return {
    state,
    latestVersion: manifest.latestVersion,
    minSupportedVersion: manifest.minSupportedVersion,
    changelog,
    iosStoreUrl: manifest.platforms.ios?.storeUrl,
    androidPlayUrl: manifest.platforms.android?.storeUrl,
    androidApkUrl: manifest.platforms.android?.apkUrl,
    desktopUpdateEndpoint: manifest.platforms.desktop?.updateEndpoint,
    dismiss,
  };
}
