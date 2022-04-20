import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { InitialState, StrategyItem, TradeData } from "@ensofinance/v1-core";

// Exported json files
export type ScriptOutput = Erc20HoldersJson | PoolMapJson | StrategyParamsMapJson;

export enum AcceptedProtocols {
  Indexed,
  PieDao,
  DHedge,
  Powerpool,
  TokenSets,
  IndexCoop,
}

export enum Adapters {
  IndexCoopAdapter = "IndexCoopAdapter",
  IndexedAdapter = "IndexedAdapter",
  PowerPoolAdapter = "PowerPoolAdapter",
  TokenSetAdapter = "TokenSetAdapter",
  DHedgeAdapter = "DHedgeAdapter",
  PieDaoAdapter = "PieDaoAdapter",
}

export type Adapter = {
  protocol: AcceptedProtocols;
  adapter: string;
};

export interface StrategyParamsMap {
  [key: string]: StrategyParams;
}

export interface StrategyParamsMapJson {
  [key: string]: StrategyParamsJson;
}

export interface StrategyParamsJson {
  name: string;
  symbol: string;
  manager: string;
  items: StrategyItemJson[];
  state: InitialStateJson;
}

export interface StrategyParams {
  name: string;
  symbol: string;
  manager: string;
  items: StrategyItem[];
  state: InitialState;
}

export interface InitialStateJson {
  timelock: string;
  rebalanceThreshold: string;
  rebalanceSlippage: string;
  restructureSlippage: string;
  performanceFee: string;
  social: boolean;
  set: boolean;
}

export interface StrategyItemJson {
  item: string;
  percentage: string;
  data: TradeData;
}

export interface Holder {
  address: string;
}

export interface HolderBalance extends Holder {
  balance: BigNumber;
}

export interface HolderBalanceJson extends Holder {
  balance: string;
}

export interface Erc20HoldersJson {
  // lp => { address, balance }
  [key: string]: HolderBalanceJson;
}
export interface Erc20Holders {
  // lp => { address, balance }
  [key: string]: HolderBalance;
}

export interface StakedPool {
  users: string[];
  lp: string;
  adapter: Contract;
  balances: BalanceMapping;
}

export interface StakedPoolJson {
  users: string[];
  lp: string;
  adapter: string;
  balances: BalanceMappingJson;
}

export interface PoolMap {
  [key: string]: StakedPool | undefined;
}

export interface PoolMapJson {
  [key: string]: StakedPoolJson | undefined;
}

export interface BalanceMapping {
  [key: string]: BigNumber | undefined;
}

export interface BalanceMappingJson {
  [key: string]: string | undefined;
}

export interface Deployments {
  // network => contracts
  [key: string]: DeployedContracts;
}

export interface DeployedContracts {
  [key: string]: string;
}
