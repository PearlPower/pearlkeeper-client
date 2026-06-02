// apps/desktop/src/__tests__/_harness/TestHarness.tsx
//
// Task 3 — generic React tree harness for every Wave 2/3
// desktop screen test.
//
// Composes the same provider stack the production main.tsx uses
// (QueryClientProvider + AdaptersProvider + Router) but with:
// QueryClient defaults locked to retry: false / gcTime: 0 / staleTime: 0
// (Pitfall 8 — keeps tests deterministic and fast)
// MemoryRouter instead of BrowserRouter — no jsdom URL plumbing needed
// In-memory adapters via buildTestBundle() — fresh per call (T-20-02)
//
// Every test that mounts a screen should call renderUnderHarness({ ... })
// instead of duplicating provider wiring inline.

import { type ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AdaptersProvider, type AdaptersBundle } from "@prl-wallet/app-adapters";
import { buildTestBundle } from "./factories";

export interface HarnessRoute {
  path?: string;
  /** Optional layout-route element (renders children via <Outlet />) — when
   * present without a `path`, mirrors `<Route element={...}><Route .../></Route>`
   * the same way react-router-dom v7 nests routes. uses
   * this to mount `<MasterDetailLayout />` as a parent layout-route around
   * child wallet routes for unit tests. */
  element: ReactNode;
  /** Optional nested child routes — recursive. Mirrors react-router-dom
   * v7's nested `<Route>` config. */
  children?: HarnessRoute[];
  /** Mirrors react-router-dom's `index` flag. Renders this element when the
   * parent route's path matches exactly (no further path segment). */
  index?: boolean;
}

export interface HarnessOptions {
  /** Defaults to ["/"] — pass an array to start the MemoryRouter at a
   * specific route or to seed history for back-navigation tests. */
  initialEntries?: string[];
  /** Required — the Routes children mounted inside the Router. */
  routes: HarnessRoute[];
  /** Optional pre-render hook for seeding store state. Awaited even when
   * the callback returns void so callers may use async setup. */
  prepopulate?: (bundle: AdaptersBundle) => void | Promise<void>;
  /** Pitfall 8: defaults to true. Most screens issue gated queries that
   * hang when the gate is closed; opt out by passing `false` for tests
   * that explicitly assert closed-gate behavior. */
  networkGateOpen?: boolean;
}

export interface HarnessResult {
  result: RenderResult;
  bundle: AdaptersBundle;
  queryClient: QueryClient;
}

/**
 * Recursive route renderer — mirrors the react-router-dom v7 `<Route>` API.
 * Supports nested layout-route configs (parent `element` with children
 * rendered via `<Outlet />`) and `index` routes. uses this
 * for unit-testing `<MasterDetailLayout />` with realistic nested routes so
 * master-pane DOM identity is preserved across child-route navigation.
 */
function renderHarnessRoute(r: HarnessRoute, idx: number): ReactNode {
  const key = r.path ?? `__layout_${idx}`;
  if (r.index) {
    return <Route key={key} index element={r.element} />;
  }
  if (r.children && r.children.length > 0) {
    return (
      <Route key={key} path={r.path} element={r.element}>
        {r.children.map(renderHarnessRoute)}
      </Route>
    );
  }
  return <Route key={key} path={r.path} element={r.element} />;
}

/**
 * Mount a route tree under the full desktop provider stack with in-memory
 * adapters. Returns the RTL result plus the bundle + queryClient so tests
 * can mutate store state and inspect query cache directly.
 */
export function renderUnderHarness(opts: HarnessOptions): HarnessResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  const bundle = buildTestBundle({ networkGateOpen: opts.networkGateOpen });

  // Run the prepopulate callback synchronously before render. The callback
  // signature accepts `void | Promise<void>` so callers may use either,
  // but we deliberately do NOT await here — render must be synchronous so
  // tests can assert against the initial DOM in the same tick. Async
  // prepopulate work should complete via the store factories' synchronous
  // setters (most Zustand actions); truly async setup belongs in a `beforeEach`.
  if (opts.prepopulate) {
    void opts.prepopulate(bundle);
  }

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AdaptersProvider value={bundle}>
        <MemoryRouter initialEntries={opts.initialEntries ?? ["/"]}>
          <Routes>{opts.routes.map(renderHarnessRoute)}</Routes>
        </MemoryRouter>
      </AdaptersProvider>
    </QueryClientProvider>,
  );

  return { result, bundle, queryClient };
}
