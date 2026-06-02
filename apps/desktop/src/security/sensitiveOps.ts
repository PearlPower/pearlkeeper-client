// apps/desktop/src/security/sensitiveOps.ts
//
// Sensitive-Op catalog: enum + per-op copy registry + partition sets.
//
// (catalog scope): 7 ops catalogued; only sign_tx + reveal_mnemonic are
// wired (WIRED_OPS) in . The remaining 5 are DEFERRED_OPS. Each
// deferred surface MUST consume <SensitiveOpGate> when it ships ().
//
// (tier mapping): type-to-confirm tier = {reveal_mnemonic, reveal_bip32_seed,
// copy_mnemonic, qr_of_mnemonic}; explain tier = {sign_tx, reveal_xpub,
// export_wallet_data}. (): renamed click-confirm →
// explain — modal renders a brief explanation, not a click-only confirm. Body
// layout in SensitiveOpWarning.tsx branches on tier: "type-to-confirm" → Input +
// locked mismatch (sourced from copy.confirmMismatch) + 3 buttons; "explain" →
// 2 buttons (action + Cancel) only.
//
// (confirm phrase + mismatch copy): ALL type-to-confirm tier ops use
// confirmPhrase "SHOW MY SEED" AND confirmMismatch "Phrase does not match — type
// exactly: SHOW MY SEED" — same root-secret mental model regardless of channel.
// (): the mismatch string was previously hardcoded inline
// in SensitiveOpWarning.tsx; it is now a registry field so the catalog test is the
// single source of truth for per-op user-visible copy.
//
// (deferred-surface contract): "Each MUST consume <SensitiveOpGate> when its
// surface ships; remove from this set + add a smoke test in the same PR."
//
// Copy values are LOCKED VERBATIM from 22-UI-SPEC.md §"Copywriting Contract".
// DO NOT paraphrase, abbreviate, or modify any string in SENSITIVE_OP_COPY.
// No React imports. No side-effect calls. Pure TypeScript module.

// ---------------------------------------------------------------------------
// SensitiveOp enum (exact key/value pairs locked; do not modify)
// ---------------------------------------------------------------------------

export const SensitiveOp = {
  SignTx: "sign_tx",
  RevealMnemonic: "reveal_mnemonic",
  RevealBip32Seed: "reveal_bip32_seed",
  RevealXpub: "reveal_xpub",
  CopyMnemonic: "copy_mnemonic",
  QrOfMnemonic: "qr_of_mnemonic",
  ExportWalletData: "export_wallet_data",
} as const satisfies Record<string, string>;

export type SensitiveOp = (typeof SensitiveOp)[keyof typeof SensitiveOp];

// ---------------------------------------------------------------------------
// FrictionTier ()
// ---------------------------------------------------------------------------

export type FrictionTier = "type-to-confirm" | "explain";

// ---------------------------------------------------------------------------
// OpCopy interface
// ---------------------------------------------------------------------------

export interface OpCopy {
  title: string;
  bodyHeadline: string;
  riskBullets: readonly string[]; // 2-3 bullets per / Pitfall 14
  primaryCtaLabel: string; // locked: "Turn off network first" ()
  continueAnywayLabel: string; // per-op (e.g. "Broadcast anyway", "Show seed phrase")
  cancelLabel: string; // locked: "Cancel" ()
  tier: FrictionTier;
  /** Required when tier === "type-to-confirm". Locked: "SHOW MY SEED" (). */
  confirmPhrase?: string;
  /**
   * Required when tier === "type-to-confirm". Locked verbatim across the four
   * mnemonic-class ops per : "Phrase does not match — type exactly: SHOW MY SEED".
   * Rendered by SensitiveOpWarning as the inline error below the type-to-confirm input
   * when the user's input is non-empty AND does not match `confirmPhrase`.
   * (): moved from inline literal in SensitiveOpWarning.tsx
   * to this registry field so the catalog test owns it.
   */
  confirmMismatch?: string;
}

// ---------------------------------------------------------------------------
// SENSITIVE_OP_COPY registry (, , + 22-UI-SPEC.md §"Copywriting Contract")
// as const satisfies Record<SensitiveOp, OpCopy> — compile-time exhaustiveness gate
// (Pattern 6, T-22-01). Adding a new SensitiveOp without a registry entry causes tsc to fail.
// ---------------------------------------------------------------------------

export const SENSITIVE_OP_COPY = {
  // explain tier — sign_tx (broadcast click)
  [SensitiveOp.SignTx]: {
    title: "Broadcast while online?",
    bodyHeadline: "Your transaction will be sent over the network.",
    riskBullets: [
      "Network metadata (timing, IP address) may be logged by your Blockbook node.",
      "Ensure you trust your Blockbook endpoint before broadcasting.",
    ],
    primaryCtaLabel: "Turn off network first",
    continueAnywayLabel: "Broadcast anyway",
    cancelLabel: "Cancel",
    tier: "explain",
  },

  // type-to-confirm tier — reveal_mnemonic (reveal seed phrase)
  [SensitiveOp.RevealMnemonic]: {
    title: "Reveal seed phrase while online?",
    bodyHeadline: "Your seed phrase is the master key to this wallet.",
    riskBullets: [
      "Any screen recording, screenshot tool, or malware running right now may capture your words.",
      "Turn off the network to eliminate live exposure before revealing.",
      "Never photograph or share your seed phrase.",
    ],
    primaryCtaLabel: "Turn off network first",
    continueAnywayLabel: "Show seed phrase",
    cancelLabel: "Cancel",
    tier: "type-to-confirm",
    confirmPhrase: "SHOW MY SEED",
    confirmMismatch: "Phrase does not match — type exactly: SHOW MY SEED",
  },

  // type-to-confirm tier — reveal_bip32_seed (deferred)
  [SensitiveOp.RevealBip32Seed]: {
    title: "Reveal BIP32 seed while online?",
    bodyHeadline: "Your BIP32 seed derives every key in this wallet.",
    riskBullets: [
      "Any screen recording or malware running right now may capture your seed.",
      "Turn off the network before revealing to minimize exposure.",
    ],
    primaryCtaLabel: "Turn off network first",
    continueAnywayLabel: "Show BIP32 seed",
    cancelLabel: "Cancel",
    tier: "type-to-confirm",
    confirmPhrase: "SHOW MY SEED",
    confirmMismatch: "Phrase does not match — type exactly: SHOW MY SEED",
  },

  // explain tier — reveal_xpub (deferred)
  [SensitiveOp.RevealXpub]: {
    title: "Reveal extended public key while online?",
    bodyHeadline:
      "Your xpub reveals your full transaction history and all future addresses.",
    riskBullets: [
      "Anyone with your xpub can monitor your wallet balance and activity.",
      "Only share your xpub with services you fully trust.",
    ],
    primaryCtaLabel: "Turn off network first",
    continueAnywayLabel: "Show xpub",
    cancelLabel: "Cancel",
    tier: "explain",
  },

  // type-to-confirm tier — copy_mnemonic (deferred)
  [SensitiveOp.CopyMnemonic]: {
    title: "Copy seed phrase while online?",
    bodyHeadline:
      "Copying your seed phrase while online risks clipboard interception.",
    riskBullets: [
      "Clipboard contents can be read by other apps and browser extensions.",
      "Turn off the network before copying to reduce this risk.",
    ],
    primaryCtaLabel: "Turn off network first",
    continueAnywayLabel: "Copy seed phrase",
    cancelLabel: "Cancel",
    tier: "type-to-confirm",
    confirmPhrase: "SHOW MY SEED",
    confirmMismatch: "Phrase does not match — type exactly: SHOW MY SEED",
  },

  // type-to-confirm tier — qr_of_mnemonic (deferred)
  [SensitiveOp.QrOfMnemonic]: {
    title: "Show seed QR code while online?",
    bodyHeadline:
      "A QR code of your seed phrase is as sensitive as the words themselves.",
    riskBullets: [
      "Screen sharing or screen capture tools can read QR codes automatically.",
      "Turn off the network before displaying.",
    ],
    primaryCtaLabel: "Turn off network first",
    continueAnywayLabel: "Show QR code",
    cancelLabel: "Cancel",
    tier: "type-to-confirm",
    confirmPhrase: "SHOW MY SEED",
    confirmMismatch: "Phrase does not match — type exactly: SHOW MY SEED",
  },

  // explain tier — export_wallet_data (deferred)
  [SensitiveOp.ExportWalletData]: {
    title: "Export wallet data while online?",
    bodyHeadline:
      "The export includes addresses, transaction history, and wallet metadata.",
    riskBullets: [
      "Ensure the export file is stored securely and not uploaded to any service.",
      "Turn off the network to prevent accidental cloud sync of the export file.",
    ],
    primaryCtaLabel: "Turn off network first",
    continueAnywayLabel: "Export anyway",
    cancelLabel: "Cancel",
    tier: "explain",
  },
} as const satisfies Record<SensitiveOp, OpCopy>;

// ---------------------------------------------------------------------------
// DEFERRED_OPS (, )
// These 5 ops have no current UI surface. Each MUST consume <SensitiveOpGate>
// when its surface ships; remove from this set + add a smoke test in the same PR.
// ---------------------------------------------------------------------------

export const DEFERRED_OPS: ReadonlySet<SensitiveOp> = new Set<SensitiveOp>([
  SensitiveOp.RevealBip32Seed,
  SensitiveOp.RevealXpub,
  SensitiveOp.CopyMnemonic,
  SensitiveOp.QrOfMnemonic,
  SensitiveOp.ExportWalletData,
]);

// ---------------------------------------------------------------------------
// WIRED_OPS () — derived: all ops not in DEFERRED_OPS.
// result: {sign_tx, reveal_mnemonic}.
// ---------------------------------------------------------------------------

export const WIRED_OPS: ReadonlySet<SensitiveOp> = new Set<SensitiveOp>(
  Object.values(SensitiveOp).filter((op) => !DEFERRED_OPS.has(op)),
);
