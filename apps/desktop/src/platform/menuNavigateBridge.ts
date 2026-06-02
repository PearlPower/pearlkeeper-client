// apps/desktop/src/platform/menuNavigateBridge.ts
//
// module-scope navigation/route bridges that connect the
// native menu's action handlers (which run outside the React tree) to
// react-router-dom's imperative navigate() and the current pathname.
//
// Why a dedicated module (deviation from plan, Rule 1):
// The plan suggested exporting setNavigateBridge/setRouteBridge from
// main.tsx. That works at runtime, but it makes App.tsx import main.tsx —
// which fires main.tsx's top-level IIFE (boot sequence + createRoot()) on
// ANY module-graph traversal, including under jsdom in test files that
// touch App.tsx (e.g. authStateMachine.test.tsx). createRoot() throws
// "Target container is not a DOM element" because the test DOM has no
// #root element. Splitting the bridges into a side-effect-free module
// keeps the App.tsx import graph free of main.tsx side effects.
//
// NavigateBridge in App.tsx populates these refs from inside <MemoryRouter>;
// menuNavigate/menuGetRoute (consumed by main.tsx::installPostRenderLocks)
// read them from outside the React tree.

let currentNavigate: ((path: string) => void) | null = null;
let currentRoute = "/";

export function setNavigateBridge(fn: ((path: string) => void) | null): void {
  currentNavigate = fn;
}

export function setRouteBridge(path: string): void {
  currentRoute = path;
}

/**
 * Native-menu-side navigate. Closes over the module-scope ref so the latest
 * NavigateBridge-supplied function is always invoked. No-op until the React
 * tree has mounted and NavigateBridge populated the ref.
 */
export const menuNavigate = (path: string): void => {
  if (currentNavigate) currentNavigate(path);
};

/**
 * Native-menu-side current-pathname accessor. Used by the selection-aware
 * Cmd+C handler to decide whether to copy the next receive address.
 */
export const menuGetRoute = (): string => currentRoute;
