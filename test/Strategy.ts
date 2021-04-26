import { IPV2SmartPool, PCappedSmartPool } from "../typechain";
import { BigNumber, Signer } from "ethers";

type Implementation = PCappedSmartPool | IPV2SmartPool;

export interface StrategyBuilder {
  signer: Signer;
  contract: Implementation;
  supply?: BigNumber;
  tokens?: string[];
  name?: string;
  holders?: Signer[];

  getHolders(contract: string): Promise<Signer[]>;

  build(address: string): Promise<Strategy>;
}
export interface Strategy {
  contract: Implementation;
  supply: BigNumber;
  tokens: string[];
  name: string;
  holders: Signer[];
  print(implementation?: string): void;
}
