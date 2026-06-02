// apps/mobile/src/__mocks__/expo-in-app-updates.ts
// jest mock for the ESM-only expo-in-app-updates package. Real
// behavior is non-functional in jest jsdom anyway (Play Services + native
// module bridge required); the helper is wrapped behind playInAppUpdate.ts
// which is exercised via per-test mocks of THIS module.

export const checkForUpdate = async () => ({
  updateAvailable: false,
  flexibleAllowed: false,
  immediateAllowed: false,
  storeVersion: "0.0.0",
  releaseDate: "1970-01-01",
  daysSinceRelease: 0,
});

export const startUpdate = async (_isImmediate?: boolean) => false;

export const completeUpdate = async () => undefined;

export const checkAndStartUpdate = async () => false;
