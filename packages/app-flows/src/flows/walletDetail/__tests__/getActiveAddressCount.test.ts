// packages/app-flows/src/flows/walletDetail/__tests__/getActiveAddressCount.test.ts
// GREEN flip of the Wave-0 RED stubs ().

import { getActiveAddressCount } from "../getActiveAddressCount.js";
import type { DerivedAddress } from "@prl-wallet/services";

const make = (
  index: number,
  hasTransactions: boolean,
): DerivedAddress => ({
  index,
  address: `addr-${index}`,
  hasTransactions,
});

describe("getActiveAddressCount ()", () => {
  it("returns 0 for an empty array", () => {
    expect(getActiveAddressCount([])).toBe(0);
  });

  it("returns 0 when no derived address has hasTransactions=true", () => {
    expect(
      getActiveAddressCount([
        make(0, false),
        make(1, false),
        make(2, false),
      ]),
    ).toBe(0);
  });

  it("returns the count of addresses with hasTransactions=true (mixed)", () => {
    // 3 active + 5 inactive => 3
    expect(
      getActiveAddressCount([
        make(0, true),
        make(1, false),
        make(2, true),
        make(3, false),
        make(4, true),
        make(5, false),
        make(6, false),
        make(7, false),
      ]),
    ).toBe(3);
  });

  it("returns the array length when every address has hasTransactions=true", () => {
    expect(
      getActiveAddressCount([make(0, true), make(1, true), make(2, true)]),
    ).toBe(3);
  });

  it("scaffold loads (sanity)", () => {
    expect(typeof getActiveAddressCount).toBe("function");
  });
});
