// apps/desktop/src/__tests__/satoshisToDisplay.test.ts
//
// Task 1 — pure-helper unit test (mobile parity).
// Locks the contract from apps/desktop/src/lib/satoshisToDisplay.ts so any
// regression that breaks the em-dash fallback (T-20-09) or the trailing-zero
// trim is caught immediately.

import { describe, test, expect } from "vitest";
import { satoshisToDisplay } from "@/lib/satoshisToDisplay";

describe("satoshisToDisplay", () => {
  test.each<[string | undefined, string]>([
    [undefined, "—"],
    ["", "—"],
    ["notanumber", "—"],
    ["100000000", "1"],
    ["41234", "0.00041234"],
    ["12345000", "0.12345"],
    ["100000001", "1.00000001"],
    ["1", "0.00000001"],
  ])("formats %p as %p", (input, expected) => {
    expect(satoshisToDisplay(input)).toBe(expected);
  });

  test("returns em-dash (T-20-09) for any non-numeric input", () => {
    expect(satoshisToDisplay("abc")).toBe("—");
    expect(satoshisToDisplay(undefined)).toBe("—");
  });
});
