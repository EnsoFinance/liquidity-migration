import { BigNumber, Contract } from "ethers";

export type ScriptOutput = HoldersWithBalance;

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

export interface HoldersWithBalance {
  // lp => { address, balance }
  [key: string]: HolderWithBalance;
}

export type HolderWithBalance = {
  address: string;
  balance: BigNumber;
};

export interface HolderBalance {
  [key: string]: string | undefined;
}

export interface HolderBalanceTyped {
  [key: string]: BigNumber;
}

export interface Deployments {
  // network => contracts
  [key: string]: DeployedContracts;
}

export interface DeployedContracts {
  [key: string]: string;
}

export interface PoolsToMigrate {
  users: string[];
  lp: string;
  adapter: Contract;
  balances: HolderBalanceTyped;
}

export interface PoolsToMigrateData {
  users: string[];
  lp: string;
  adapter: string;
  balances: HolderBalance;
}
