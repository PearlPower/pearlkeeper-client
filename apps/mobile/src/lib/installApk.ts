// apps/mobile/src/lib/installApk.ts
//
// Android-only direct APK side-load. Downloads the signed APK from the
// release's `androidApkUrl` to the app cache directory, then fires the
// system package-installer intent. The user still sees the standard
// "Install unknown apps" gate the first time — REQUEST_INSTALL_PACKAGES
// (added to AndroidManifest.xml) is the permission that lets that gate
// fire instead of a flat refusal.
//
// iOS calls are a no-op (the function returns { ok: false, reason: "ios" })
// because side-load is platform-forbidden — iOS panels send users to the
// App Store URL directly.

import { Platform } from "react-native";
// expo-file-system@19 exposes the synchronous File/Directory API at the
// package root; the function-style `downloadAsync` + `cacheDirectory` we
// use here live under the `/legacy` subpath. Both are first-party and
// supported per Expo SDK 54 docs.
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";

export type InstallApkResult =
  | { ok: true }
  | {
      ok: false;
      reason: "ios" | "no-cache-dir" | "download-failed" | "intent-failed";
    };

export async function installApk(apkUrl: string): Promise<InstallApkResult> {
  if (Platform.OS !== "android") return { ok: false, reason: "ios" };
  // cacheDirectory is typed as `string | null` because some bare RN setups
  // can boot without one. We need a concrete path to write the APK; bail
  // with a distinct reason so the caller can surface an actionable message
  // instead of getting an opaque file-system error from downloadAsync.
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return { ok: false, reason: "no-cache-dir" };
  const path = `${cacheDir}update.apk`;
  try {
    const { uri, status } = await FileSystem.downloadAsync(apkUrl, path);
    if (status < 200 || status >= 300) {
      return { ok: false, reason: "download-failed" };
    }
    const contentUri = await FileSystem.getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      type: "application/vnd.android.package-archive",
      // FLAG_GRANT_READ_URI_PERMISSION — required by the system installer
      // to read the cache-directory FileProvider URI.
      flags: 1,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "intent-failed" };
  }
}
