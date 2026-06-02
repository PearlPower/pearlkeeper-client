// MasterDetailLayout tests — sidebar (shadcn) replaces the prior custom
// aside. Settings is now a sidebar route (D-NEW: post-UAT feedback). Tests
// assert on semantic DOM (testids, aria-current, present text) rather than
// Tailwind class strings, since the shadcn Sidebar handles its own
// responsive rules and the prior `min-[900px]:*` invariants no longer apply.

import { describe, test, expect } from "vitest";
import { screen, act } from "@testing-library/react";
import { useNavigate } from "react-router-dom";
import { MasterDetailLayout } from "@/screens/MasterDetailLayout";
import { renderUnderHarness } from "./_harness/TestHarness";
import { seedWallet } from "./_harness/factories";

function NavigateButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button
      data-testid={`nav-button-${label}`}
      type="button"
      onClick={() => navigate(to)}
    >
      go-{label}
    </button>
  );
}

describe("MasterDetailLayout (sidebar)", () => {
  test("renders the master/detail wrapper and the sidebar (master pane)", () => {
    renderUnderHarness({
      routes: [
        {
          element: <MasterDetailLayout />,
          children: [
            {
              path: "wallet/:id",
              element: <div data-testid="detail-w1">detail</div>,
            },
          ],
        },
      ],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(
            seedWallet({ id: "w1", name: "Test BTC", networkId: "btc-testnet" }),
          );
      },
    });

    expect(screen.getByTestId("master-detail-grid")).toBeInTheDocument();
    expect(screen.getByTestId("master-pane")).toBeInTheDocument();
  });

  test("the route element corresponding to the active path renders inside the layout (Outlet)", () => {
    renderUnderHarness({
      routes: [
        {
          element: <MasterDetailLayout />,
          children: [
            {
              path: "wallet/:id",
              element: <div data-testid="detail-w1">detail</div>,
            },
          ],
        },
      ],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", name: "Test BTC" }));
      },
    });

    expect(screen.getByTestId("detail-w1")).toBeInTheDocument();
  });

  test("master pane DOM identity is preserved across navigation between /wallet/:id and /wallet/:id/send/address", async () => {
    renderUnderHarness({
      routes: [
        {
          element: <MasterDetailLayout />,
          children: [
            {
              path: "wallet/:id",
              element: (
                <NavigateButton to="/wallet/w1/send/address" label="to-send" />
              ),
            },
            {
              path: "wallet/:id/send/address",
              element: <div data-testid="detail-send-addr">send-addr</div>,
            },
          ],
        },
      ],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", name: "Test BTC" }));
      },
    });

    const firstMaster = screen.getByTestId("master-pane");

    const navBtn = screen.getByTestId("nav-button-to-send");
    await act(async () => {
      navBtn.click();
    });

    expect(screen.getByTestId("detail-send-addr")).toBeInTheDocument();
    const secondMaster = screen.getByTestId("master-pane");

    // react-router-dom v7 preserves the parent layout-route element across
    // child-route navigation. Because <MasterDetailLayout /> is the parent
    // route element, the master pane DOM node MUST be the SAME element
    // instance after the child route swaps.
    expect(secondMaster).toBe(firstMaster);
  });

  test("rendering at /wallet/w1 with multiple seeded wallets marks the row corresponding to w1 with aria-current='page'", () => {
    renderUnderHarness({
      routes: [
        {
          element: <MasterDetailLayout />,
          children: [
            {
              path: "wallet/:id",
              element: <div data-testid="detail-w1">detail</div>,
            },
          ],
        },
      ],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", name: "Test BTC" }));
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w2", name: "Test PRL" }));
      },
    });

    const activeBtn = screen.getByRole("button", {
      name: /test btc/i,
      current: "page",
    });
    expect(activeBtn).toBeInTheDocument();
    expect(activeBtn).toHaveAttribute("aria-current", "page");
  });

  test("Settings link in the sidebar footer is present and navigates to /settings", async () => {
    renderUnderHarness({
      routes: [
        {
          element: <MasterDetailLayout />,
          children: [
            {
              path: "wallet/:id",
              element: <div data-testid="detail-w1">detail</div>,
            },
            {
              path: "settings",
              element: <div data-testid="settings-screen">settings</div>,
            },
          ],
        },
      ],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", name: "Test BTC" }));
      },
    });

    const settingsLink = screen.getByTestId("sidebar-settings-link");
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).not.toHaveAttribute("aria-current", "page");

    await act(async () => {
      settingsLink.click();
    });

    expect(screen.getByTestId("settings-screen")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-settings-link")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Lock button in the sidebar footer locks the wallet when clicked", async () => {
    const { bundle } = renderUnderHarness({
      routes: [
        {
          element: <MasterDetailLayout />,
          children: [
            {
              path: "wallet/:id",
              element: <div data-testid="detail-w1">detail</div>,
            },
          ],
        },
      ],
      initialEntries: ["/wallet/w1"],
      prepopulate: (b) => {
        b.stores.walletList
          .getState()
          .addWallet(seedWallet({ id: "w1", name: "Test BTC" }));
        b.stores.lock.getState().unlock();
      },
    });

    expect(bundle.stores.lock.getState().isLocked).toBe(false);

    const lockBtn = screen.getByTestId("sidebar-lock-button");
    expect(lockBtn).toBeInTheDocument();

    await act(async () => {
      lockBtn.click();
    });

    expect(bundle.stores.lock.getState().isLocked).toBe(true);
  });

  test("Settings link is marked aria-current='page' when route starts with /settings", () => {
    renderUnderHarness({
      routes: [
        {
          element: <MasterDetailLayout />,
          children: [
            {
              path: "settings",
              element: <div>settings root</div>,
            },
            {
              path: "settings/change-pin",
              element: <div>change pin</div>,
            },
          ],
        },
      ],
      initialEntries: ["/settings/change-pin"],
    });

    expect(screen.getByTestId("sidebar-settings-link")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
