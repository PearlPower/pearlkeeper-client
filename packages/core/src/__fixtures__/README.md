# Crypto Parity Vectors

This directory holds the frozen-snapshot test contract that proves the crypto
stack does not drift across builds, platforms, or refactors. The single source
file is `cryptoVectors.ts`.

## Purpose

`cryptoVectors.ts` locks **inputs** (mnemonic, network params, derivation paths)
together with **expected outputs** (BIP86 spec addresses, internal keys, Schnorr
signature) computed once at planning time. If any consumer of `@prl-wallet/core`
re-runs these inputs and gets different outputs, that's a regression — caught
immediately by the tests that import this file:

- `packages/core/src/__tests__/{schnorr,address,derive,keys,mnemonic,tx}.test.ts`
- `apps/desktop/src/__tests__/cryptoParity.test.ts`
- `apps/desktop/src/screens/Parity/ParityScreen.tsx` (dev-only visual mirror)

## Why not import from `blockchains.json`

`blockchains.json` is **product config** — it answers "what chains do we
currently support?" Networks come and go with product decisions (chains added,
disabled via `enabled: false`, removed entirely).

`cryptoVectors.ts` is a **test contract** — it answers "given these frozen
inputs, does our crypto stack still produce these frozen outputs?"

These are different questions with different lifetimes. Coupling them means:

- Disabling a network in `blockchains.json` breaks the test. (We hit this exact
  failure when `prl-testnet.enabled` was flipped to `false`.)
- Removing PRL from the product would delete the parity test entirely.
- The regression contract becomes hostage to product roadmap decisions.

The fixture intentionally **does not import `@prl-wallet/config`**. The
exported network constants are frozen copies of the relevant version bytes.
They may visually duplicate values in `blockchains.json`, but that's
deliberate — the test contract owns its inputs.

## What's locked, why

| Constant | What it locks |
| -------------------------- | ----------------------------------------------------------------- |
| `TEST_MNEMONIC` | BIP86 spec test mnemonic. Used by every derivation test. |
| `BTC_MAINNET` | Bitcoin Core protocol constants. Required for BIP86 spec vectors. |
| `PRL_MAINNET` | Version bytes that produced `EXPECTED_SCHNORR_SIG_HEX`. |
| `PRL_TESTNET` | Coin type 1 + `tprl` HRP — proves the testnet derivation path. |
| `*_BIP86_PATH` | Derivation paths frozen alongside the expected outputs. |
| `EXPECTED_BTC_*` | Official BIP86 spec vectors. Will never change. |
| `EXPECTED_SCHNORR_SIG_HEX` | Planning-time snapshot. Locks the PRL Schnorr code path. |

## When to update

**Almost never.** Most edits to this file are bugs. The legitimate reasons:

### 1. Deliberate PRL protocol change

If `blockchains.json` prl-mainnet `bip32`/`bech32` is updated as a deliberate
protocol change (not a bug fix to align with this fixture), then:

1. Update the corresponding constant in `cryptoVectors.ts`.
2. Re-derive `EXPECTED_SCHNORR_SIG_HEX` (see below).
3. Commit with a `BREAKING:` prefix referencing the protocol decision.

### 2. New network added to the fixture

Adding e.g. BTC testnet coverage is OK _if_ a test needs it. Don't speculatively
add networks.

### 3. New expected vector added

Adding a new `EXPECTED_*` snapshot for a new code path is fine. Don't mutate
existing snapshots.

## When NOT to update

- **Network disabled in `blockchains.json`** — the fixture is independent of
  `enabled` state.
- **Refactor in `@prl-wallet/core`** — the whole point of the snapshot is that
  refactors must not change the outputs.
- **Drift discovered between fixture and `blockchains.json`** — investigate
  which side is wrong. Don't reflexively update the fixture to match config;
  the snapshot may be the canonical record.
- **Cosmetic edits** — comments yes, values no.

## How to re-derive `EXPECTED_SCHNORR_SIG_HEX`

```ts
import { mnemonicToSeedSync } from "@scure/bip39";
import { BIP32, signSchnorr } from "@prl-wallet/core";
import {
  TEST_MNEMONIC,
  PRL_MAINNET,
  PRL_MAINNET_BIP86_PATH,
  SCHNORR_TEST_MESSAGE,
} from "./cryptoVectors.js";

const seed = Buffer.from(mnemonicToSeedSync(TEST_MNEMONIC));
const child = BIP32.fromSeed(seed, PRL_MAINNET).derivePath(
  PRL_MAINNET_BIP86_PATH,
);
const { signature } = signSchnorr(
  Buffer.from(child.privateKey!),
  SCHNORR_TEST_MESSAGE,
);
console.log(signature);
```

`auxRand` is a 32-byte zero buffer (deterministic — see `schnorr.ts`).

## Optional follow-up: consistency check

If you want to detect silent drift between this fixture and `blockchains.json`,
add a separate test that asserts the relevant fields match. When they diverge,
the test fails and you make an explicit choice — update the fixture (and
re-derive the Schnorr sig if needed) or leave it alone. This stays out of the
contract path: the contract still works even if config changes.
