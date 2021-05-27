import { IPV2SmartPool, PCappedSmartPool } from "../typechain";
import { BigNumber, Signer, Contract } from "ethers";

// All possible strategy contract types [PieDao, DPI, TokenSets, Enso]
export type Implementation = PCappedSmartPool | IPV2SmartPool;

export interface StrategyBuilder {
  signer: Signer;

  connect(): Promise<StrategyEnvironment>;
  getHolders(contract: string): Promise<Signer[]>;

  getPool(address: string, implementation: Implementation): Promise<Strategy>;
}

export interface StrategyEnvironment {
  signer: Signer;
  registry: Contract;
  admin: Signer;
  implementations: Implementation[];
  pools: Strategy[];
}

export interface Strategy {
  contract: Implementation;
  supply: BigNumber;
  tokens: string[];
  name: string;
  holders: Signer[];
  print(implementation?: string): void;
}
