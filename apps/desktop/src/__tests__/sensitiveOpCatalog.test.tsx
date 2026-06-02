// apps/desktop/src/__tests__/sensitiveOpCatalog.test.tsx
//
// Task 2 — SECUX-06 catalog completeness test.
// Asserts: every SensitiveOp has registered copy; locked-copy tokens present;
// DEFERRED_OPS + WIRED_OPS partition is exhaustive and disjoint; tier mapping
// per ; WIRED_OPS and DEFERRED_OPS exact membership per .
//
// This file PASSES now (catalog source of truth exists in sensitiveOps.ts).
// Threats T-22-01..T-22-05 mitigated at runtime by these assertions.

import { describe, test, expect } from "vitest";
import {
  SensitiveOp,
  SENSITIVE_OP_COPY,
  DEFERRED_OPS,
  WIRED_OPS,
  type OpCopy,
} from "@/security/sensitiveOps";

describe("SECUX-06: catalog completeness", () => {
  test("every SensitiveOp has a registered copy entry", () => {
    for (const op of Object.values(SensitiveOp)) {
      // Cast to OpCopy to widen from the as const literal union — optional fields
      // (confirmPhrase, confirmMismatch) are present on OpCopy but absent from the
      // specific literal types of explain-tier entries. The satisfies clause guarantees
      // every entry conforms to OpCopy, so the cast is safe.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const copy = SENSITIVE_OP_COPY[op] as unknown as OpCopy;
      expect(copy).toBeDefined();
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.riskBullets.length).toBeGreaterThanOrEqual(2);
      expect(copy.riskBullets.length).toBeLessThanOrEqual(3);
      expect(["type-to-confirm", "explain"]).toContain(copy.tier);
      if (copy.tier === "type-to-confirm") {
        expect(copy.confirmPhrase).toBe("SHOW MY SEED");
        expect(copy.confirmMismatch).toBeTruthy();
        expect(typeof copy.confirmMismatch).toBe("string");
        expect(copy.confirmMismatch).toBe(
          "Phrase does not match — type exactly: SHOW MY SEED",
        );
      } else {
        expect(copy.confirmPhrase).toBeUndefined();
        expect(copy.confirmMismatch).toBeUndefined();
      }
      expect(copy.primaryCtaLabel).toBe("Turn off network first");
      expect(copy.cancelLabel).toBe("Cancel");
    }
  });

  test("DEFERRED_OPS + WIRED_OPS partitions all ops with no overlap", () => {
    const all = new Set(Object.values(SensitiveOp));
    const union = new Set([...WIRED_OPS, ...DEFERRED_OPS]);
    expect(union).toEqual(all);
    for (const op of WIRED_OPS) expect(DEFERRED_OPS.has(op)).toBe(false);
  });

  test("WIRED_OPS contains exactly {sign_tx, reveal_mnemonic} per ", () => {
    expect([...WIRED_OPS].sort()).toEqual(
      [SensitiveOp.RevealMnemonic, SensitiveOp.SignTx].sort(),
    );
  });

  test("DEFERRED_OPS contains exactly the 5 deferred surfaces per ", () => {
    expect([...DEFERRED_OPS].sort()).toEqual(
      [
        SensitiveOp.CopyMnemonic,
        SensitiveOp.ExportWalletData,
        SensitiveOp.QrOfMnemonic,
        SensitiveOp.RevealBip32Seed,
        SensitiveOp.RevealXpub,
      ].sort(),
    );
  });

  test("tier mapping per ", () => {
    const typeToConfirm = Object.values(SensitiveOp).filter(
      (op) => SENSITIVE_OP_COPY[op].tier === "type-to-confirm",
    );
    const explain = Object.values(SensitiveOp).filter(
      (op) => SENSITIVE_OP_COPY[op].tier === "explain",
    );
    expect(typeToConfirm.sort()).toEqual(
      [
        SensitiveOp.CopyMnemonic,
        SensitiveOp.QrOfMnemonic,
        SensitiveOp.RevealBip32Seed,
        SensitiveOp.RevealMnemonic,
      ].sort(),
    );
    expect(explain.sort()).toEqual(
      [SensitiveOp.ExportWalletData, SensitiveOp.RevealXpub, SensitiveOp.SignTx].sort(),
    );
  });
});
