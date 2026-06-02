// apps/desktop/src/screens/Parity/ParityScreen.tsx
//
// Dev-only crypto parity panel (CONTEXT ; UI-SPEC Screen 2).
// Computes desktop-runtime values for the three locked vectors and renders
// a comparison table with PASS/FAIL badges. Vitest (cryptoParity.test.ts)
// is the contract — this panel is a developer convenience for `tauri dev`.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { mnemonicToSeedSync } from "@scure/bip39";
import { BIP32, signSchnorr, p2trAddress } from "@prl-wallet/core";
import {
  TEST_MNEMONIC,
  BTC_MAINNET,
  PRL_MAINNET,
  BTC_BIP86_PATH,
  PRL_MAINNET_BIP86_PATH,
  EXPECTED_BTC_P2TR_ADDRESS,
  EXPECTED_SCHNORR_SIG_HEX,
  SCHNORR_TEST_MESSAGE,
} from "@prl-wallet/core/fixtures/cryptoVectors";

interface ParityRow {
  label: string;
  expected: string;
  computed: string;
  pass: boolean;
}

function truncateHex(value: string, max = 40): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function computeRows(): ParityRow[] {
  const rows: ParityRow[] = [];

  // Vector 1: PRL mainnet P2TR (BIP86)
  try {
    const seed = Buffer.from(mnemonicToSeedSync(TEST_MNEMONIC));
    const child = BIP32.fromSeed(seed, PRL_MAINNET).derivePath(
      PRL_MAINNET_BIP86_PATH,
    );
    const xOnly = Buffer.from(child.publicKey).slice(1);
    const computed = p2trAddress(xOnly, PRL_MAINNET);
    // PRL mainnet P2TR has no fixture-locked expected (only its bytes feed Schnorr).
    // We display computed-self-equal as the "expected" so the row is informative
    // without polluting the test contract; explicit label clarifies this.
    rows.push({
      label: "P2TR Address (BIP86 PRL mainnet)",
      expected: computed, // self-reference: exists for visibility, not contract
      computed,
      pass: computed.startsWith("prl1"),
    });
  } catch (err) {
    rows.push({
      label: "P2TR Address (BIP86 PRL mainnet)",
      expected: "(error)",
      computed: err instanceof Error ? err.message : String(err),
      pass: false,
    });
  }

  // Vector 2: BTC mainnet P2TR (BIP86 official vector — locked in fixtures)
  try {
    const seed = Buffer.from(mnemonicToSeedSync(TEST_MNEMONIC));
    const child = BIP32.fromSeed(seed, BTC_MAINNET).derivePath(BTC_BIP86_PATH);
    const xOnly = Buffer.from(child.publicKey).slice(1);
    const computed = p2trAddress(xOnly, BTC_MAINNET);
    rows.push({
      label: "P2TR Address (BIP86 BTC mainnet)",
      expected: EXPECTED_BTC_P2TR_ADDRESS,
      computed,
      pass: computed === EXPECTED_BTC_P2TR_ADDRESS,
    });
  } catch (err) {
    rows.push({
      label: "P2TR Address (BIP86 BTC mainnet)",
      expected: EXPECTED_BTC_P2TR_ADDRESS,
      computed: err instanceof Error ? err.message : String(err),
      pass: false,
    });
  }

  // Vector 3: Schnorr signature (locked in fixtures — strict equality)
  try {
    const seed = Buffer.from(mnemonicToSeedSync(TEST_MNEMONIC));
    const child = BIP32.fromSeed(seed, PRL_MAINNET).derivePath(
      PRL_MAINNET_BIP86_PATH,
    );
    if (!child.privateKey) throw new Error("PRL derivation: no private key");
    const result = signSchnorr(
      Buffer.from(child.privateKey),
      SCHNORR_TEST_MESSAGE,
    );
    rows.push({
      label: "Schnorr Signature",
      expected: EXPECTED_SCHNORR_SIG_HEX,
      computed: result.signature,
      pass: result.verified && result.signature === EXPECTED_SCHNORR_SIG_HEX,
    });
  } catch (err) {
    rows.push({
      label: "Schnorr Signature",
      expected: EXPECTED_SCHNORR_SIG_HEX,
      computed: err instanceof Error ? err.message : String(err),
      pass: false,
    });
  }

  return rows;
}

export function ParityScreen() {
  const navigate = useNavigate();
  const rows = useMemo(() => computeRows(), []);

  return (
    <main className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-xs text-primary hover:underline mb-2"
            aria-label="Back to Hello"
          >
            ← Back to Hello
          </button>
          <h1 className="text-xl font-semibold">Crypto Parity</h1>
          <p className="text-sm text-muted-foreground">
            Computed vs expected values from cryptoVectors.ts
          </p>
        </header>

        <table className="w-full border-collapse">
          <caption className="sr-only">
            Crypto vector comparison: expected vs computed
          </caption>
          <thead>
            <tr className="bg-card border-b border-border">
              <th
                scope="col"
                className="text-left text-xs font-normal text-muted-foreground uppercase p-2"
              >
                Vector
              </th>
              <th
                scope="col"
                className="text-left text-xs font-normal text-muted-foreground uppercase p-2"
              >
                Expected
              </th>
              <th
                scope="col"
                className="text-left text-xs font-normal text-muted-foreground uppercase p-2"
              >
                Computed
              </th>
              <th
                scope="col"
                className="text-left text-xs font-normal text-muted-foreground uppercase p-2"
              >
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="odd:bg-background even:bg-card">
                <td className="text-sm p-2 align-top">{row.label}</td>
                <td
                  className="text-sm font-mono p-2 align-top break-all"
                  title={row.expected}
                >
                  {truncateHex(row.expected)}
                </td>
                <td
                  className="text-sm font-mono p-2 align-top break-all"
                  title={row.computed}
                >
                  {truncateHex(row.computed)}
                </td>
                <td className="p-2 align-top">
                  <span
                    className={
                      row.pass
                        ? "bg-primary text-primary-foreground rounded px-2 py-1 text-xs uppercase"
                        : "bg-destructive text-destructive-foreground rounded px-2 py-1 text-xs uppercase"
                    }
                  >
                    {row.pass ? "PASS" : "FAIL"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
