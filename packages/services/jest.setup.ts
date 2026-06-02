import type { BlockchainConfig } from "@prl-wallet/config";
import testBlockchains from "@prl-wallet/config/blockchains.test.json";

import { __setBlockchainsForTests } from "./src/network/resolveNetworkContext";

__setBlockchainsForTests(
  testBlockchains.blockchains as unknown as BlockchainConfig[],
);
