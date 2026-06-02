import { act, renderHook } from "@testing-library/react";
import { useSendAddress } from "../useSendAddress.js";

describe("useSendAddress", () => {
  const mockNetwork = {} as import("bitcoinjs-lib").Network;

  it("routes scanner permission denial through onInvalidScan (no direct Alert/Camera imports)", async () => {
    const onScanRequested = jest.fn().mockResolvedValue(false);
    const onInvalidScan = jest.fn();

    const { result } = renderHook(() =>
      useSendAddress({
        walletNetwork: mockNetwork,
        bip21Prefix: "bitcoin",
        invalidAddressMessage: "Invalid Bitcoin address. Please check.",
        isWatchOnly: false,
        onScanRequested,
        onInvalidScan,
      }),
    );

    await act(async () => {
      await result.current.openScanner();
    });

    expect(onScanRequested).toHaveBeenCalledTimes(1);
    expect(onInvalidScan).toHaveBeenCalledWith(
      "Camera permission required",
      "Please enable camera access in Settings to scan QR codes.",
    );
    expect(result.current.scannerVisible).toBe(false);
  });

  it("opens the scanner when onScanRequested resolves true", async () => {
    const onScanRequested = jest.fn().mockResolvedValue(true);
    const onInvalidScan = jest.fn();

    const { result } = renderHook(() =>
      useSendAddress({
        walletNetwork: mockNetwork,
        bip21Prefix: "bitcoin",
        invalidAddressMessage: "Invalid Bitcoin address. Please check.",
        isWatchOnly: false,
        onScanRequested,
        onInvalidScan,
      }),
    );

    await act(async () => {
      await result.current.openScanner();
    });

    expect(onScanRequested).toHaveBeenCalledTimes(1);
    expect(onInvalidScan).not.toHaveBeenCalled();
    expect(result.current.scannerVisible).toBe(true);
    expect(result.current.scanned).toBe(false);
  });

  it("parses BIP21 QR scan payload and clears the scanner", () => {
    const { result } = renderHook(() =>
      useSendAddress({
        walletNetwork: mockNetwork,
        bip21Prefix: "bitcoin",
        invalidAddressMessage: "Invalid Bitcoin address. Please check.",
        isWatchOnly: false,
        onScanRequested: jest.fn().mockResolvedValue(true),
        onInvalidScan: jest.fn(),
      }),
    );

    act(() => {
      result.current.handleQRScanned({
        data: "bitcoin:bc1qtestaddress?amount=0.1",
      });
    });

    expect(result.current.recipientAddress).toBe("bc1qtestaddress");
    expect(result.current.scannerVisible).toBe(false);
    expect(result.current.scanned).toBe(true);
  });

  it("validates the recipient address using the active wallet network", () => {
    const { result } = renderHook(() =>
      useSendAddress({
        walletNetwork: mockNetwork,
        bip21Prefix: "bitcoin",
        invalidAddressMessage: "Invalid Bitcoin address. Please check.",
        isWatchOnly: false,
        onScanRequested: jest.fn().mockResolvedValue(true),
        onInvalidScan: jest.fn(),
      }),
    );

    act(() => {
      result.current.setRecipientAddress(" bc1qvalid ");
    });

    let ok = false;
    act(() => {
      ok = result.current.validateAddress();
    });
    expect(ok).toBe(true);
    expect(result.current.recipientAddress).toBe("bc1qvalid");
    expect(result.current.addressError).toBeNull();
  });

  it("rejects malformed addresses and surfaces the invalid-address message", () => {
    const { result } = renderHook(() =>
      useSendAddress({
        walletNetwork: mockNetwork,
        bip21Prefix: "bitcoin",
        invalidAddressMessage: "Invalid Bitcoin address. Please check.",
        isWatchOnly: false,
        onScanRequested: jest.fn().mockResolvedValue(true),
        onInvalidScan: jest.fn(),
      }),
    );

    act(() => {
      result.current.setRecipientAddress("not-an-address");
    });

    let ok = true;
    act(() => {
      ok = result.current.validateAddress();
    });
    expect(ok).toBe(false);
    expect(result.current.addressError).toBe(
      "Invalid Bitcoin address. Please check.",
    );
  });

  it("blocks validation for watch-only wallets without toggling scanner state", () => {
    const { result } = renderHook(() =>
      useSendAddress({
        walletNetwork: mockNetwork,
        bip21Prefix: "bitcoin",
        invalidAddressMessage: "Invalid Bitcoin address. Please check.",
        isWatchOnly: true,
        onScanRequested: jest.fn().mockResolvedValue(true),
        onInvalidScan: jest.fn(),
      }),
    );

    let ok = true;
    act(() => {
      ok = result.current.validateAddress();
    });
    expect(ok).toBe(false);
  });
});
