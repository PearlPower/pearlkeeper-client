import type { RootStackParamList } from "./types";
type RouteParams<Route extends keyof RootStackParamList> =
  RootStackParamList[Route];

describe("RootStackParamList navigation types", () => {
  it("WalletList route has undefined params", () => {
    const _check: RouteParams<"WalletList"> = undefined;
    expect(_check).toBeUndefined();
  });

  it("WalletDetail route has walletId string param", () => {
    const _check: RouteParams<"WalletDetail"> = { walletId: "wallet-uuid-123" };
    expect(_check.walletId).toBe("wallet-uuid-123");
  });

  it("Receive route has walletId param", () => {
    const _check: RouteParams<"Receive"> = {
      walletId: "wallet-uuid-123",
    };
    expect(_check.walletId).toBe("wallet-uuid-123");
  });

  it("SendFlow route has walletId param", () => {
    const _check: RouteParams<"SendFlow"> = {
      walletId: "wallet-uuid-123",
    };
    expect(_check.walletId).toBe("wallet-uuid-123");
  });
});
