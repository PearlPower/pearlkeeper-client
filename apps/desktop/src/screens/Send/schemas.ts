// apps/desktop/src/screens/Send/schemas.ts
// zod schema factories wrapping the pure validators
// from @prl-wallet/app-flows. The validators stay pure in the shared
// package; zod is a desktop-UI-only adapter (no zod imports leak into
// packages/*).
//
// Note: SendFeeTierId from @prl-wallet/app-flows uses "slow" | "medium" | "fast" | "custom"
// (not "normal") — aligned with the shared type in packages/app-flows/src/flows/send/types.ts.
import { z } from "zod";
import type { Network } from "bitcoinjs-lib";
import {
  parsePrlToSats,
  validateRecipientAddress,
} from "@prl-wallet/app-flows";

export function addressSchema(network: Network | null) {
  return z.object({
    address: z
      .string()
      .min(1, "Enter a recipient address.")
      .refine((v) => validateRecipientAddress(v.trim(), network), {
        message: "Enter a valid address.",
      }),
  });
}

export function amountSchema(spendableSats: bigint) {
  return z.object({
    amount: z
      .string()
      .min(1, "Enter an amount.")
      .refine((v) => parsePrlToSats(v) !== null, {
        message: "Enter a valid amount.",
      })
      .refine(
        (v) => {
          const sats = parsePrlToSats(v);
          return sats !== null && sats > 0n;
        },
        { message: "Amount must be greater than 0." },
      )
      .refine(
        (v) => {
          const sats = parsePrlToSats(v);
          return sats !== null && sats <= spendableSats;
        },
        { message: "Amount exceeds your spendable balance." },
      ),
  });
}

export function feeSchema() {
  return z.object({
    tier: z.enum(["slow", "medium", "fast", "custom"]),
    customSatVbyte: z
      .string()
      .refine(
        (v) => {
          if (v === "") return true; // empty is fine when tier !== "custom"
          const n = Number.parseInt(v, 10);
          return !Number.isNaN(n) && n >= 1 && Number.isInteger(n);
        },
        { message: "Fee must be a positive whole number." },
      ),
  });
}
