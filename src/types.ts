import { BigNumber, Contract } from "ethers";

export type ScriptOutput = Erc20Holders;

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
