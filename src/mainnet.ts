import hre from "hardhat";
import { ethers, waffle } from "hardhat";
import { Event, BigNumber, constants, Contract, ContractInterface } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PieDaoAdapter__factory } from "../typechain";
import { toErc20 } from "./utils";
import {
  DeployedContracts,
  BalanceMapping,
  StakedPoolJson,
  StakedPool,
  Adapter,
  Adapters,
  AcceptedProtocols,
  HolderBalance,
  Erc20Holders,
  Erc20HoldersJson,
  HolderBalanceJson,
} from "./types";
import deployments from "../deployments.json";
import poolsToMigrate from "../out/above_threshold.json";
import LiquidityMigrationV2 from "../artifacts/contracts/migration/LiquidityMigrationV2.sol/LiquidityMigrationV2.json";
import TokenSetAdapter from "../artifacts/contracts/adapters/TokenSetAdapter.sol/TokenSetAdapter.json";
import PieDaoAdapter from "../artifacts/contracts/adapters/PieDaoAdapter.sol/PieDaoAdapter.json";
import BalancerAdapter from "../artifacts/contracts/adapters/BalancerAdapter.sol/BalancerAdapter.json";
import DHedgeAdapter from "../artifacts/contracts/adapters/DHedgeAdapter.sol/DHedgeAdapter.json";
const { AddressZero, WeiPerEther } = constants;
import tokenHolders from "../out/erc20_holders.json";

export const MIN_ETH_SIGNER = WeiPerEther.mul(10);

export function getMainnetDeployments(): DeployedContracts {
  if (!deployments.mainnet) {
    throw Error("deployments.json file not found");
  }
  const d: DeployedContracts = deployments.mainnet;
  return d;
}

export async function getTransferEvents(
  addr: string,
  start: number,
  end: number,
  signer: SignerWithAddress,
): Promise<[Event[], Contract]> {
  const abi = [
    "event Transfer(address indexed src, address indexed dst, uint val)",
    "function balanceOf(address user) public view returns (uint)",
  ];
  const contract = new Contract(addr, abi, signer.provider);
  let filter = contract.filters.Transfer(null, null);
  let transfers = await contract.queryFilter(filter, start, end);
  return [transfers, contract];
}

export function readTokenHolders(): Erc20Holders {
  if (!tokenHolders) {
    throw Error("erc20_holders.json not found. Run scripts/getHoldersWithBalance.ts");
  }
  const holders: Erc20Holders = {};
  const holdersJson: Erc20HoldersJson = tokenHolders;
  const keys: string[] = Object.keys(holdersJson);
  keys.map(k => {
    const holder = holdersJson[k];
    const address = holder.address;
    const balance = BigNumber.from(holder.balance);
    holders[k] = { address, balance };
  });
  return holders;
}

// Search numBlocks to find token holder
export async function getErc20Holder(
  erc20: string,
  startBlock: number,
  endBlock: number,
  signer: SignerWithAddress,
): Promise<HolderBalanceJson | undefined> {
  if (!signer.provider) throw Error("No provider attached to signer");
  const [transfers, contract] = await getTransferEvents(erc20, startBlock, endBlock, signer);
  if (transfers.length) {
    const balances: HolderBalance[] = await Promise.all(
      transfers.map(async t => {
        const balance = await contract.balanceOf(t.args?.dst);
        const address = t.args?.dst;
        return { balance, address };
      }),
    );
    const withBalance: HolderBalance[] = balances.filter(b => b.balance.gt(BigNumber.from(0)));
    if (withBalance.length) {
      // TODO: check for highest balance?
      let holder: HolderBalance = withBalance[0];
      if (!holder) throw Error("This shouldn't happen");
      const holderJson: HolderBalanceJson = { address: holder.address, balance: holder.balance.toString() };
      return holderJson;
    }
  }
  return getErc20Holder(erc20, startBlock - 2000, endBlock - 2000, signer);
}

// Return contract interface if one of Adapters enum
export function getAdapterInterface(adapter: string, contractName: Adapters, signer: SignerWithAddress): Contract {
  switch (contractName) {
    case Adapters.IndexCoopAdapter:
      return new Contract(adapter, TokenSetAdapter.abi, signer);
    case Adapters.IndexedAdapter:
      return new Contract(adapter, BalancerAdapter.abi, signer);
    case Adapters.PowerPoolAdapter:
      return new Contract(adapter, BalancerAdapter.abi, signer);
    case Adapters.TokenSetAdapter:
      return new Contract(adapter, TokenSetAdapter.abi, signer);
    case Adapters.DHedgeAdapter:
      return new Contract(adapter, DHedgeAdapter.abi, signer);
    case Adapters.PieDaoAdapter:
      return new Contract(adapter, PieDaoAdapter.abi, signer);
    default:
      throw Error(`Adapter: ${contractName} doesnt exist`);
  }
}

export async function getAdapterFromType(adapterType: Adapters, signer: SignerWithAddress): Promise<Contract> {
  const liveContracts = getMainnetDeployments();
  const keys = Object.keys(liveContracts);
  for (let i = 0; i < keys.length; i++) {
    const aType = keys[i] as Adapters;
    if (aType === adapterType) {
      const adapter = await getAdapterInterface(liveContracts[aType], adapterType, signer);
      return adapter;
    }
  }
  throw Error("Failed to find adapter");
}

// Find protocol adapter for this address on mainnet
export async function getAdapterFromAddr(addr: string, signer: SignerWithAddress): Promise<Contract> {
  const liveContracts = getMainnetDeployments();
  const keys = Object.keys(liveContracts);
  for (let i = 0; i < keys.length; i++) {
    const contractName = keys[i];
    const contractAddr = liveContracts[contractName];
    if (!contractAddr) throw Error(`Failed to find deployed contract: ${contractName}`);
    const aType = contractName as Adapters;
    if (contractAddr.toLowerCase() == addr.toLowerCase()) {
      const adapter = await getAdapterInterface(contractAddr, aType, signer);
      return adapter;
    }
  }
  throw Error("Failed to find adapter");
}

// Parse staked users json and populate balances as BigNumber + adapter as Contract
export async function getPoolsToMigrate(signer: SignerWithAddress): Promise<StakedPool[]> {
  const poolsData: StakedPoolJson[] = poolsToMigrate;
  const pools: StakedPool[] = [];
  for (let i = 0; i < poolsData.length; i++) {
    const p = poolsData[i];
    const keys: string[] = Object.keys(p.balances);
    const balances: BalanceMapping = {};
    keys.map((addr, iter) => {
      balances[addr] = BigNumber.from(p.balances[addr]);
    });
    const adapter = await getAdapterFromAddr(p.adapter, signer);
    const pool: StakedPool = { users: p.users, balances, lp: p.lp, adapter };
    pools[i] = pool;
  }
  return pools;
}

export function liveMigrationContract(signer: SignerWithAddress): Contract {
  if (!deployments.mainnet || !deployments.mainnet.LiquidityMigrationV2) {
    throw Error("Failed to find LiquidityMigration2 address");
  }
  const migration = new Contract(deployments.mainnet.LiquidityMigrationV2, LiquidityMigrationV2.abi, signer);
  return migration;
}

export async function impersonateWithEth(addr: string, value: BigNumber): Promise<SignerWithAddress> {
  await hre.network.provider.send("hardhat_setBalance", [addr, "0xFFFFFFFFFFFFFFFFFFFFF"]);

  const signer = await impersonateAccount(addr);
  return signer;
}

export async function impersonateAccount(addr: string): Promise<SignerWithAddress> {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addr],
  });
  const signer = waffle.provider.getSigner(addr);
  const signerWithAddress = await ethers.getSigner(addr);
  return signerWithAddress;
}
