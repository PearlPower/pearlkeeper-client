import { initializeSecurityState } from "../bootstrapSecurity.js";

describe("initializeSecurityState", () => {
  it("waits for first-boot wipe before reading the PIN hash", async () => {
    const calls: string[] = [];
    let releaseWipe: (() => void) | null = null;

    const wipeIfNeeded = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          calls.push("wipe:start");
          releaseWipe = () => {
            calls.push("wipe:end");
            resolve();
          };
        }),
    );
    const loadPINHash = jest.fn(async () => {
      calls.push("pin:read");
      return null;
    });
    const setHasPIN = jest.fn();
    const setHasPINLoaded = jest.fn();

    const run = initializeSecurityState({
      setHasPIN,
      setHasPINLoaded,
      wipeIfNeeded,
      loadPINHash,
      logError: jest.fn(),
    });

    await Promise.resolve();
    expect(calls).toEqual(["wipe:start"]);
    expect(loadPINHash).not.toHaveBeenCalled();

    expect(releaseWipe).not.toBeNull();
    releaseWipe!();
    await run;

    expect(calls).toEqual(["wipe:start", "wipe:end", "pin:read"]);
    expect(setHasPIN).toHaveBeenCalledWith(false);
    expect(setHasPINLoaded).toHaveBeenCalledWith(true);
  });

  it("still loads the PIN state when the wipe step fails", async () => {
    const logError = jest.fn();
    const setHasPIN = jest.fn();
    const setHasPINLoaded = jest.fn();

    await initializeSecurityState({
      setHasPIN,
      setHasPINLoaded,
      wipeIfNeeded: jest.fn(async () => {
        throw new Error("wipe failed");
      }),
      loadPINHash: jest.fn(async () => "pin-hash"),
      logError,
    });

    expect(logError).toHaveBeenCalledWith(expect.any(Error));
    expect(setHasPIN).toHaveBeenCalledWith(true);
    expect(setHasPINLoaded).toHaveBeenCalledWith(true);
  });
});
