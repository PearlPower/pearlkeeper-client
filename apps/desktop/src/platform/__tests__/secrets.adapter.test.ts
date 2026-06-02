// apps/desktop/src/platform/__tests__/secrets.adapter.test.ts
//
// Wave 2 — typed-error mapping test (activated).

import { describe, it, vi, expect, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { createDesktopSecrets } from "../secrets";

const mockedInvoke = invoke as unknown as Mock;

describe("createDesktopSecrets — typed error mapping", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("maps SecretError::NoBackend to thrown Error('KEYCHAIN_UNAVAILABLE')", async () => {
    mockedInvoke.mockRejectedValueOnce({ kind: "NoBackend" });
    const port = createDesktopSecrets();
    await expect(port.getMnemonic("w1")).rejects.toThrow(
      "KEYCHAIN_UNAVAILABLE",
    );
  });

  it("maps SecretError::ValueTooLarge to thrown Error('KEYCHAIN_UNAVAILABLE')", async () => {
    mockedInvoke.mockRejectedValueOnce({
      kind: "ValueTooLarge",
      data: { bytes: 5000 },
    });
    const port = createDesktopSecrets();
    await expect(
      port.storeMnemonic("w1", "abandon".repeat(500)),
    ).rejects.toThrow("KEYCHAIN_UNAVAILABLE");
  });

  it("logs the typed SecretError via console.error before rethrowing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const errPayload = { kind: "AccessDenied" };
    mockedInvoke.mockRejectedValueOnce(errPayload);

    const port = createDesktopSecrets();
    await expect(port.getMnemonic("w1")).rejects.toThrow(
      "KEYCHAIN_UNAVAILABLE",
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const callArgs = errorSpy.mock.calls[0];
    expect(callArgs[0]).toBe("[keychain]");
    expect(callArgs[1]).toBe("secrets_get");
    expect(callArgs[2]).toEqual(errPayload);

    errorSpy.mockRestore();
  });

  it("constructs the keychain key as `wallet_<id>_<suffix>` and `pin_hash`", async () => {
    mockedInvoke.mockResolvedValue("decoy");
    const port = createDesktopSecrets();

    await port.getMnemonic("w1");
    const calls1 = mockedInvoke.mock.calls;
    const lastWalletCall = calls1[calls1.length - 1];
    expect(lastWalletCall?.[0]).toBe("secrets_get");
    expect(lastWalletCall?.[1]).toEqual({ key: "wallet_w1_mnemonic" });

    await port.getPinHash();
    const calls2 = mockedInvoke.mock.calls;
    const lastPinCall = calls2[calls2.length - 1];
    expect(lastPinCall?.[0]).toBe("secrets_get");
    expect(lastPinCall?.[1]).toEqual({ key: "pin_hash" });
  });

  it("deleteWalletSecrets calls secrets_delete for all four suffixes", async () => {
    mockedInvoke.mockResolvedValue(undefined);
    const port = createDesktopSecrets();

    await port.deleteWalletSecrets("w1");

    const deleteCalls = mockedInvoke.mock.calls.filter(
      (c) => c[0] === "secrets_delete",
    );
    expect(deleteCalls).toHaveLength(4);

    const deletedKeys = deleteCalls
      .map((c) => (c[1] as { key: string }).key)
      .sort();
    expect(deletedKeys).toEqual([
      "wallet_w1_bip32_seed",
      "wallet_w1_mnemonic",
      "wallet_w1_type",
      "wallet_w1_xpub",
    ]);
  });
});
