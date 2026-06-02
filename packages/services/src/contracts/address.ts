export interface DerivedAddress {
  index: number;
  address: string;
  hasTransactions: boolean;
}

export type AddressDiscoveryWarningCode =
  | "address_lookup_failed"
  | "partial_gap_scan";

export interface ServiceWarning {
  code: AddressDiscoveryWarningCode;
  message: string;
}

export interface AddressDiscoveryResult {
  derivedAddresses: DerivedAddress[];
  receiveAddressIndex: number;
  receiveAddress: string;
  warnings: ServiceWarning[];
}
