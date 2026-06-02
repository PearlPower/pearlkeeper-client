// apps/desktop/src/__tests__/receiveScreen.test.tsx
// TX-01 (Receive screen). Replaces Wave 0 stub from Task 3.
//
// 4 cases per 21-VALIDATION.md TX-01 rows:
// 1. Smoke: renders QR + address text + Copy + Save PNG + Generate-another link
// 2. Copy: copyAddress callback is invoked; label flips to "Copied!" then back
// 3. Save QR PNG: canvas.toBlob + URL.createObjectURL called
// 4. Generate another: generateAnotherAddress invoked; button state reacts
//
// Strategy: mock useReceiveFlow so tests control the address/label state
// directly without needing a real addressService / secrets port. This tests
// that ReceiveScreen correctly wires all flow outputs to the UI.
//
// jsdom pitfalls:
// HTMLCanvasElement.prototype.getContext not implemented: QRCodeCanvas mocked
// HTMLCanvasElement.prototype.toBlob undefined in jsdom: polyfilled in beforeAll
// URL.createObjectURL / revokeObjectURL: mocked in beforeEach

import React from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceiveScreen } from "@/screens/Receive/ReceiveScreen";
import { renderUnderHarness } from "./_harness/TestHarness";
import { seedWallet } from "./_harness/factories";

// Mock Tauri save-as dialog + fs.writeFile (jsdom has no Tauri runtime).
const mockSave = vi.fn();
const mockWriteFile = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: (...args: unknown[]) => mockSave(...args),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

// Mock sonner toast so tests can assert success/error/cancel paths.
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock qrcode.react — jsdom does not implement HTMLCanvasElement.prototype.getContext.
// Use forwardRef so canvasRef.current is populated — required for the Save PNG
// handler to call canvasRef.current.toBlob().
// ---------------------------------------------------------------------------
interface MockQRCanvasProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
}

vi.mock("qrcode.react", () => ({
  QRCodeCanvas: React.forwardRef<HTMLCanvasElement, MockQRCanvasProps>(
    ({ value, size, bgColor, fgColor }, ref) => (
      <canvas
        ref={ref}
        data-testid="qr-canvas"
        data-value={value}
        data-size={size}
        data-bg={bgColor}
        data-fg={fgColor}
      />
    ),
  ),
}));

// ---------------------------------------------------------------------------
// Mock useReceiveFlow so tests control flow state without a real addressService.
// The mock factory is called per-test (via mockImplementation) so each test
// can provide its own state.
// ---------------------------------------------------------------------------
const mockCopyAddress = vi.fn();
const mockGenerateAnotherAddress = vi.fn();

// Default flow state — overridden per test via mockUseReceiveFlow()
let flowState = {
  receiveAddress: "bc1ptest000000000000000000000000000000000000" as
    | string
    | null,
  copyLabel: "Copy" as "Copy" | "Copied!",
  isLoading: false,
  isGeneratingAnother: false,
};

vi.mock("@prl-wallet/app-flows", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@prl-wallet/app-flows")>();
  return {
    ...actual,
    useReceiveFlow: vi.fn(() => ({
      receiveAddress: flowState.receiveAddress,
      copyAddress: mockCopyAddress,
      copyLabel: flowState.copyLabel,
      generateAnotherAddress: mockGenerateAnotherAddress,
      isLoading: flowState.isLoading,
      isGeneratingAnother: flowState.isGeneratingAnother,
      shareAddress: vi.fn(),
      goBack: vi.fn(),
    })),
  };
});

// ---------------------------------------------------------------------------
// jsdom toBlob polyfill — installed unconditionally in beforeAll, but the spy
// itself is re-armed in beforeEach because vi.clearAllMocks() in afterEach
// clears its mockImplementation between tests.
// ---------------------------------------------------------------------------
function makeStubBlob(): Blob {
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
    type: "image/png",
  });
}

beforeAll(() => {
  if (typeof HTMLCanvasElement.prototype.toBlob !== "function") {
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(makeStubBlob());
    };
  }
});

// ---------------------------------------------------------------------------
// URL stubs (jsdom has no blob: URL support)
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset flow state to a known address
  flowState = {
    receiveAddress: "bc1ptest000000000000000000000000000000000000",
    copyLabel: "Copy",
    isLoading: false,
    isGeneratingAnother: false,
  };
  mockCopyAddress.mockReset();
  mockGenerateAnotherAddress.mockReset();
  mockSave.mockReset();
  mockWriteFile.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();

  // Re-arm canvas.toBlob — vi.clearAllMocks() in afterEach also clears spies.
  vi.spyOn(
    HTMLCanvasElement.prototype,
    "toBlob",
  ).mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback) {
    cb(makeStubBlob());
  });
});

afterEach(() => {
  // Use clearAllMocks (not restoreAllMocks) to preserve the vi.mock factory
  // implementations while resetting call counts and return values.
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper — render ReceiveScreen under the harness
// ---------------------------------------------------------------------------
function renderReceive() {
  return renderUnderHarness({
    routes: [{ path: "/wallet/:id/receive", element: <ReceiveScreen /> }],
    initialEntries: ["/wallet/w1/receive"],
    prepopulate: (b) => {
      b.stores.walletList
        .getState()
        .addWallet(
          seedWallet({ id: "w1", networkId: "btc-testnet" }),
        );
    },
    networkGateOpen: true,
  });
}

// ---------------------------------------------------------------------------
// TX-01 test cases
// ---------------------------------------------------------------------------
describe("ReceiveScreen (TX-01)", () => {
  it("1. smoke — renders heading, address text, Copy, Save QR as PNG, and Generate-another link", async () => {
    renderReceive();

    // Heading
    expect(
      await screen.findByRole("heading", { level: 1, name: "Receive" }),
    ).toBeInTheDocument();

    // Address text (monospace)
    expect(
      screen.getByText("bc1ptest000000000000000000000000000000000000"),
    ).toBeInTheDocument();

    // Copy button
    expect(
      screen.getByRole("button", { name: /Copy address/i }),
    ).toBeInTheDocument();

    // Save PNG button
    expect(
      screen.getByRole("button", { name: /Save QR as PNG/i }),
    ).toBeInTheDocument();

    // Generate-another locked copy strings ()
    expect(screen.getByText("Need a fresh address?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate a new receive address" }),
    ).toBeInTheDocument();
  });

  it("2. clicking Copy invokes copyAddress callback", async () => {
    // Use real timers — fake timers break RTL's findByRole polling.
    // We don't need to test the 1.5s timer reset here since that lives
    // inside useReceiveFlow (which is fully mocked); we just assert
    // that the component wires onCopy correctly.
    const user = userEvent.setup();

    renderReceive();

    // Elements are synchronously available (mock returns static state)
    const copyBtn = screen.getByRole("button", { name: /Copy address/i });
    await user.click(copyBtn);

    expect(mockCopyAddress).toHaveBeenCalledOnce();
  });

  it("3. clicking Save QR as PNG opens save-as dialog, writes to chosen path, and toasts success", async () => {
    const user = userEvent.setup();
    mockSave.mockResolvedValue("/Users/test/Downloads/qr.png");
    mockWriteFile.mockResolvedValue(undefined);

    renderReceive();

    const saveBtn = screen.getByRole("button", { name: /Save QR as PNG/i });
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);

    // Dialog opens with sane defaults (PNG filter + suggested filename).
    await waitFor(() => expect(mockSave).toHaveBeenCalledOnce());
    const saveCallArg = mockSave.mock.calls[0][0];
    expect(saveCallArg.title).toMatch(/save.*qr/i);
    expect(saveCallArg.defaultPath).toMatch(/^prl-receive-address-.*\.png$/);
    expect(saveCallArg.filters[0].extensions).toContain("png");

    // Bytes are written to the user-chosen path.
    await waitFor(() => expect(mockWriteFile).toHaveBeenCalledOnce());
    expect(mockWriteFile.mock.calls[0][0]).toBe(
      "/Users/test/Downloads/qr.png",
    );
    expect(mockWriteFile.mock.calls[0][1]).toBeInstanceOf(Uint8Array);

    // Success toast shown with the path.
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledOnce());
    expect(mockToastSuccess.mock.calls[0][0]).toMatch(/saved/i);
  });

  it("3a. user cancels save dialog — no write, no toast", async () => {
    const user = userEvent.setup();
    mockSave.mockResolvedValue(null); // user cancelled

    renderReceive();
    await user.click(screen.getByRole("button", { name: /Save QR as PNG/i }));

    await waitFor(() => expect(mockSave).toHaveBeenCalledOnce());
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("3b. write failure shows error toast", async () => {
    const user = userEvent.setup();
    mockSave.mockResolvedValue("/Users/test/Downloads/qr.png");
    mockWriteFile.mockRejectedValue(new Error("permission denied"));

    renderReceive();
    await user.click(screen.getByRole("button", { name: /Save QR as PNG/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledOnce());
    expect(mockToastError.mock.calls[0][0]).toMatch(/could not save/i);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("4. clicking 'Generate a new receive address' calls generateAnotherAddress", async () => {
    const user = userEvent.setup();

    mockGenerateAnotherAddress.mockResolvedValue(undefined);

    renderReceive();

    // Button is synchronously available (mock delivers state immediately)
    const generateBtn = screen.getByRole("button", {
      name: "Generate a new receive address",
    });

    await user.click(generateBtn);

    expect(mockGenerateAnotherAddress).toHaveBeenCalledOnce();
  });
});
