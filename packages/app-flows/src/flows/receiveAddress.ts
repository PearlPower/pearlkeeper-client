export type ReceiveAddressCandidate = {
  address: string;
  hasTransactions: boolean;
};

export function resolveMaintainedReceiveAddress(
  derivedAddresses: ReceiveAddressCandidate[],
  discoveredReceiveAddress: string,
  storedReceiveAddress?: string,
) {
  if (!storedReceiveAddress) {
    return discoveredReceiveAddress;
  }

  const storedAddress = derivedAddresses.find(
    (entry) => entry.address === storedReceiveAddress,
  );

  if (storedAddress && !storedAddress.hasTransactions) {
    return storedReceiveAddress;
  }

  return discoveredReceiveAddress;
}
