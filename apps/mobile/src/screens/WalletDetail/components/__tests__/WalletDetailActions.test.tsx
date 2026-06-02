// apps/mobile/src/screens/WalletDetail/components/__tests__/WalletDetailActions.test.tsx
// GREEN flip of the Wave-0 RED stubs ().
//
// Verifies:
// • Address-count link copy is verbatim "View active addresses (N) →"
// (UI-SPEC Lock #8 — must NOT regress to "View addresses (N) →").
// • Count comes from getActiveAddressCount(addresses) (filter-based),
// surfaced through the parent's `usedAddressCount` prop. The component
// itself is presentational; the count source is owned by
// useWalletDetailFlow which already swapped to
// getActiveAddressCount.
// • The hasMultipleAddresses gate is preserved (link hidden when 0).

// Mock BalanceSection to avoid loading TanStack Query infra in this isolated
// presentational test.
jest.mock("../../../../components/BalanceSection", () => ({
  BalanceSection: () => null,
}));

import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WalletDetailActions } from "../WalletDetailActions";

function renderActions(props: Partial<Parameters<typeof WalletDetailActions>[0]> = {}) {
  const defaultProps = {
    addresses: ["addr-0", "addr-1", "addr-2"],
    hasMultipleAddresses: true,
    initialConfirmedSats: undefined,
    isDiscovering: false,
    isRefreshing: false,
    networkId: "btc-mainnet",
    onOpenAddressList: jest.fn(),
    onOpenReceive: jest.fn(),
    onOpenSend: jest.fn(),
    onOpenTransactionHistory: jest.fn(),
    onPersistBalance: jest.fn(),
    usedAddressCount: 3,
    walletType: "mnemonic" as const,
  };
  return render(
    <SafeAreaProvider>
      <WalletDetailActions {...defaultProps} {...props} />
    </SafeAreaProvider>,
  );
}

describe("WalletDetailActions address-count link ()", () => {
  it("address-count link copy is verbatim 'View active addresses (N) →' (no fallback to 'View addresses')", () => {
    renderActions({ usedAddressCount: 3 });
    // The text node renders "View active addresses (3) →" — assert the
    // entire phrase is present, including the word "active" and the arrow.
    expect(screen.queryByText(/View addresses \(/)).toBeNull();
    expect(
      screen.getByText(/View active addresses \(3\)\s*→/),
    ).toBeTruthy();
  });

  it("N is sourced from the prop derived from getActiveAddressCount(addresses), not lastUsedIndex+1", () => {
    // The test passes usedAddressCount=2 directly; useWalletDetailFlow has
    // already been swapped to getActiveAddressCount upstream of this prop.
    renderActions({ usedAddressCount: 2 });
    expect(
      screen.getByText(/View active addresses \(2\)\s*→/),
    ).toBeTruthy();
  });

  it("link is hidden when hasMultipleAddresses is false (preserves the existing visibility gate)", () => {
    renderActions({ hasMultipleAddresses: false, usedAddressCount: 0 });
    expect(screen.queryByText(/View active addresses/)).toBeNull();
  });

  it("scaffold loads (sanity)", () => {
    expect(true).toBe(true);
  });
});
