import hre from "hardhat";
import { ethers, waffle } from "hardhat";
import { BigNumber, constants, Contract, ContractInterface } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PieDaoAdapter__factory } from "../typechain";
import { toErc20 } from "./utils";
import {
  DeployedContracts,
  HolderBalanceTyped,
  PoolsToMigrate,
  PoolsToMigrateData,
  Adapter,
  Adapters,
  AcceptedProtocols,
  HolderWithBalance,
} from "./types";
import deployments from "../deployments.json";
import poolsToMigrate from "../out/above_threshold.json";
import LiquidityMigrationV2 from "../artifacts/contracts/migration/LiquidityMigrationV2.sol/LiquidityMigrationV2.json";
import TokenSetAdapter from "../artifacts/contracts/adapters/TokenSetAdapter.sol/TokenSetAdapter.json";
import PieDaoAdapter from "../artifacts/contracts/adapters/PieDaoAdapter.sol/PieDaoAdapter.json";
import BalancerAdapter from "../artifacts/contracts/adapters/BalancerAdapter.sol/BalancerAdapter.json";
import DHedgeAdapter from "../artifacts/contracts/adapters/DHedgeAdapter.sol/DHedgeAdapter.json";

const { AddressZero } = constants;

export function getMainnetDeployments(): DeployedContracts {
  if (!deployments.mainnet) {
    throw Error("deployments.json file not found");
  }
  const d: DeployedContracts = deployments.mainnet;
  return d;
}

export async function getHolderWithBalance(
  balances: HolderBalanceTyped,
  lp: string,
  signer: SignerWithAddress,
): Promise<HolderWithBalance> {
  const erc20 = toErc20(lp, signer);
  const addrs = Object.keys(balances);
  let balance: BigNumber = BigNumber.from(0);
  let address = "";
  for (let i = 0; i < addrs.length; i += 4) {
    // TODO: multicall
    const b = await erc20.balanceOf(addrs[i]);
    if (b.gt(balance)) {
      balance = b;
    }
    address = addrs[i];
  }
  if (balance.eq(BigNumber.from(0))) {
    throw Error("Failed to find balanace higher than 0");
  } else {
    return { address, balance } as HolderWithBalance;
  }
}

// Return contract interface if one of Adapters enum
export async function getAdapterInterface(
  adapter: string,
  contractName: Adapters,
  signer: SignerWithAddress,
): Promise<Contract> {
  switch (contractName) {
    case Adapters.IndexCoopAdapter:
      return new Contract(adapter, TokenSetAdapter.abi, signer);
    case Adapters.IndexedAdapter:
      return new Contract(adapter, TokenSetAdapter.abi, signer);
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
    const aType = contractName as Adapters;
    if (contractAddr.toLowerCase() == addr.toLowerCase()) {
      const adapter = await getAdapterInterface(contractAddr, aType, signer);
      return adapter;
    }
  }
  throw Error("Failed to find adapter");
  //return new Contract(AddressZero, [], signer.provider)
}

// Parse staked users json and populate balances as BigNumber + adapter as Contract
export async function getPoolsToMigrate(signer: SignerWithAddress): Promise<PoolsToMigrate[]> {
  const poolsData: PoolsToMigrateData[] = poolsToMigrate;
  const pools: PoolsToMigrate[] = [];
  for (let i = 0; i < poolsData.length; i++) {
    const p = poolsData[i];
    const keys: string[] = Object.keys(p.balances);
    const balances: HolderBalanceTyped = {};
    keys.map((addr, iter) => {
      balances[addr] = BigNumber.from(p.balances[addr]);
    });
    const adapter = await getAdapterFromAddr(p.adapter, signer);
    const pool: PoolsToMigrate = { users: p.users, balances, lp: p.lp, adapter };
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

export async function impersonateAccount(addr: string): Promise<SignerWithAddress> {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [addr],
  });
  const signer = waffle.provider.getSigner(addr);
  const signerWithAddress = await ethers.getSigner(addr);
  return signerWithAddress;
}
