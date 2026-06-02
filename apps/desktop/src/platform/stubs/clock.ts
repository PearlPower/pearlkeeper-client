// apps/desktop/src/platform/stubs/clock.ts

import type { ClockPort } from "@prl-wallet/app-adapters";

export const clockStub: ClockPort = {
  now: () => Date.now(),
};
