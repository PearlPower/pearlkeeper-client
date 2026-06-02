// packages/app-flows/src/flows/updateBanner/UpdateBanner.types.ts
//
// Shared types for the unified update panel (mobile + desktop). Platform-
// neutral: the hook returns every URL from the version-manifest payload and
// the concatenated changelog markdown; each app picks which buttons to
// render based on its own `Platform.OS` / build target.

/** Three banner states surfaced by useUpdateBanner. */
export type BannerState = "hidden" | "nudge" | "forced";

/** Result returned by useUpdateBanner. Mobile + desktop UpdateBanner consume this. */
export interface UpdateBannerResult {
  state: BannerState;
  latestVersion: string;
  minSupportedVersion: string;
  /** Markdown — concatenated `changelog` of every release > installedVersion. */
  changelog: string;
  /** App Store URL. iOS panel renders the "Update" button against this. */
  iosStoreUrl?: string;
  /** Google Play URL. Android panel renders the "Open Play Store" button. */
  androidPlayUrl?: string;
  /** Direct APK URL. Android panel renders the "Install update" button. */
  androidApkUrl?: string;
  /** Tauri auto-updater manifest endpoint. Desktop panel triggers `installAndRestart`. */
  desktopUpdateEndpoint?: string;
  /** Persists `dismissedVersion = latestVersion` so nudge stays hidden until next bump. */
  dismiss: () => Promise<void>;
}

/** Inputs to useUpdateBanner — provided by the consuming app. */
export interface UseUpdateBannerArgs {
  /** Currently installed app version (mobile reads from expo-application; desktop from getVersion()). */
  installedVersion: string;
  /** Reads the dismissed version persisted from a prior session. */
  getDismissedVersion: () => Promise<string | null>;
  /** Persists a new dismissed version when user taps the nudge dismiss "✕". */
  setDismissedVersion: (version: string) => Promise<void>;
  /**
   * Optional fetch for the concatenated changelog markdown across every
   * release > installedVersion. Wired up by the consuming app to
   * `BackendApiClient.getReleasesSince` (mobile + desktop). When absent or
   * the call fails, the panel still renders with an empty changelog so the
   * install buttons remain reachable.
   */
  getChangelog?: (currentVersion: string) => Promise<string>;
}
