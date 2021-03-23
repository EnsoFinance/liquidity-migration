const hre = require("hardhat");
const { ethers } = hre;
import { expect } from "chai";
import { MainnetSigner } from "../types";
import { PIE_DAO_HOLDERS } from "../src/constants";
import { BigNumber, Contract, Signer } from "ethers";
import { StrategyBuilder, Strategy, Implementation } from "./strategy";

import { FACTORY_REGISTRIES } from "../src/constants";
import { IPV2SmartPool, PCappedSmartPool } from "../typechain";

export class PieDaoEnvironmentBuilder implements StrategyBuilder {
  signer: Signer;

  constructor(signer: Signer) {
    this.signer = signer;
  }
  async connect(): Promise<PieDaoEnvironment> {
    const registry = await hre.ethers.getVerifiedContractAt(FACTORY_REGISTRIES.PIE_DAO_SMART_POOLS);
    console.log("PieDaoRegistry: ", registry.address);

    const pieDaoAdmin = await registry.connect(this.signer).owner();
    const admin = await new MainnetSigner(pieDaoAdmin).impersonateAccount();

    const pools = [];
    const implementations = [];
    implementations.push(
      (await hre.ethers.getVerifiedContractAt("0x706F00ea85a71EB5d7C2ce2aD61DbBE62b616435")) as IPV2SmartPool,
    );
    implementations.push(
      (await hre.ethers.getVerifiedContractAt("0xf13f977AaC9B001f155889b9EFa7A6628Fb7a181")) as PCappedSmartPool,
    );

    for (let i = 0; i < 6; i++) {
      const poolAddr = await registry.connect(this.signer).entries(i);
      expect(await registry.connect(this.signer).inRegistry(poolAddr)).to.eq(true);
      const proxy = await hre.ethers.getVerifiedContractAt(poolAddr);
      const implementation = await proxy.connect(this.signer).getImplementation();
      const abi = implementation === implementations[0] ? implementations[0] : implementations[1];
      try {
        const pool = await this.getPool(poolAddr, abi);
        pools.push(pool);
        pool.print(implementation);
      } catch (e) {
        console.error("Couldnt handle: ", implementation); //Experi-pie?
        continue;
      }
    }

      return new PieDaoEnvironment(this.signer, registry, admin, implementations, pools)
  }
  async getHolders(contract: string): Promise<Signer[]> {
    const addresses = PIE_DAO_HOLDERS[contract];
    if (addresses === undefined) {
      throw Error(`Failed to find token holder for contract: ${contract} `);
    }
    const signers = [];
    for (let i = 0; i < addresses.length; i++) {
      const signer = await new MainnetSigner(addresses[i]).impersonateAccount();
      signers.push(signer);
    }
    return signers as Signer[];
  }

  async getPool(address: string, implementation: Implementation): Promise<PieDaoPool> {
    const contract = implementation.attach(address);
    let tokens: string[], supply: BigNumber, name: string, holders: Signer[];
    ;[tokens, supply, name, holders] = await Promise.all([
      await contract.connect(this.signer).getTokens(),
      await contract.connect(this.signer).totalSupply(),
      await contract.connect(this.signer).name(),
      await this.getHolders(contract.address),
    ]);
    name = name === undefined ? "No Name" : name;
    supply = supply === undefined ? BigNumber.from(0) : supply;
    if (tokens === undefined) throw Error("Failed to get tokens");
    if (supply === undefined) throw Error("Failed to get supply");
    return new PieDaoPool(contract, supply, tokens, name, holders);
  }
}

export class PieDaoEnvironment {
  signer: Signer;
  registry: Contract;
  admin: Signer;
  implementations: Implementation[];
  pools: PieDaoPool[];
  constructor(
    signer: Signer,
    registry: Contract,
    admin: Signer,
    implementations: Implementation[],
    pools: PieDaoPool[],
  ) {
    this.signer = signer;
    this.registry = registry;
    this.admin = admin;
    this.implementations = implementations;
    this.pools = pools;
  }
}

export class PieDaoPool implements Strategy {
  contract: Implementation;
  supply: BigNumber;
  tokens: string[];
  name: string;
  holders: Signer[];

  constructor(contract: Implementation, supply: BigNumber, tokens: string[], name: string, holders: Signer[]) {
    this.contract = contract;
    this.supply = supply;
    this.tokens = tokens;
    this.name = name;
    this.holders = holders;
  }

  print(implementation?: string) {
    console.log("SmartPool: ", this.name);
    console.log("  Address: ", this.contract.address);
    if (implementation) console.log("  Implementation: ", implementation);
    console.log("  Supply: ", this.supply?.toString());
    console.log("  Tokens: ", this.tokens);
    console.log("");
  }
}
