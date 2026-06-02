// packages/services/src/ports/releases.ts
//
// Port surface for the unified release-update mechanism. Consumed by
// useUpdateBanner (via getChangelog) on mobile + desktop. Mobile + desktop
// createServicePorts wire this against BackendApiClient.getReleasesSince.
// Tests that don't exercise the update panel can leave it undefined.

import type { ReleasesSinceResponse } from "@prl-wallet/api-schemas";

export interface ReleasesPort {
  /**
   * Fetches releases newer than `currentVersion`, ordered newest first.
   * Throws BackendNetworkError / BackendValidationError per the api-client
   * taxonomy — callers in useUpdateBanner swallow errors so the panel
   * still renders the install buttons with an empty changelog.
   */
  getReleasesSince(currentVersion: string): Promise<ReleasesSinceResponse>;
}
