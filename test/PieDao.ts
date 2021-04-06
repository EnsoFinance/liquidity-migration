// import { ethers, hre } from "hardhat";
const hre = require("hardhat");
const { ethers } = hre;
import { SmartPoolRegistry, IPV2SmartPool, PCappedSmartPool, Impl } from "../typechain";
import { Signers, MainnetSigner } from "../types";
import { shouldMigrateFromSmartPool } from "./PieDao.behavior";
import { FACTORY_REGISTRIES, PIE_DAO_HOLDERS } from "../src/constants";
import { expect } from "chai";
import { BigNumber, Contract, Signer } from "ethers";
const { ZERO_ADDRESS } = ethers;

type Implementation = PCappedSmartPool | IPV2SmartPool;

class SmartPoolBuilder {
  signer: Signer;
  contract: Implementation;
  // controller?: string;
  supply?: BigNumber;
  tokens?: string[];
  name?: string;
  holders?: Signer[];

  constructor(signer: Signer, contract: Implementation) {
    this.contract = contract;
    this.signer = signer;
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

  async build(address: string): Promise<SmartPool> {
    this.contract = this.contract.attach(address);
    // this.controller = await this.contract.connect(this.signer).getController();
    this.tokens = await this.contract.connect(this.signer).getTokens();
    this.supply = await this.contract.connect(this.signer).totalSupply();
    this.name = await this.contract.connect(this.signer).name();
    this.name = this.name === undefined ? "No Name" : this.name;
    this.holders = await this.getHolders(this.contract.address);
    return new SmartPool(this.contract, this.supply, this.tokens, this.name, this.holders);
  }
}

class SmartPool {
  contract: Implementation;
  // controller: string;
  supply: BigNumber;
  tokens: string[];
  name: string;
  holders: Signer[];

  constructor(
    contract: Implementation,
    // controller: string,
    supply: BigNumber,
    tokens: string[],
    name: string,
    holders: Signer[],
  ) {
    this.contract = contract;
    // this.controller = controller;
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
    // console.log("  Controller: ", this.controller);
    console.log("");
  }
}

describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];

    this.smartPoolRegistry = (await hre.ethers.getVerifiedContractAt(
      FACTORY_REGISTRIES.PIE_DAO_SMART_POOLS,
    )) as SmartPoolRegistry;
    console.log("PieDaoRegistry: ", this.smartPoolRegistry.address);

    const pieDaoAdmin = await this.smartPoolRegistry.connect(this.signers.default).owner();
    this.signers.admin = await new MainnetSigner(pieDaoAdmin).impersonateAccount();

    this.pools = [];
    this.pV2SmartPool = (await hre.ethers.getVerifiedContractAt(
      "0x706F00ea85a71EB5d7C2ce2aD61DbBE62b616435",
    )) as IPV2SmartPool;
    this.PCappedSmartPool = (await hre.ethers.getVerifiedContractAt(
      "0xf13f977AaC9B001f155889b9EFa7A6628Fb7a181",
    )) as PCappedSmartPool;

    for (let i = 0; i < 6; i++) {
      const poolAddr = await this.smartPoolRegistry.connect(this.signers.default).entries(i);
      expect(await this.smartPoolRegistry.connect(this.signers.default).inRegistry(poolAddr)).to.eq(true);
      const proxy = await hre.ethers.getVerifiedContractAt(poolAddr);
      const implementation = await proxy.connect(this.signers.default).getImplementation();
      if (implementation === "0xf13f977AaC9B001f155889b9EFa7A6628Fb7a181") {
        const poolBuilder = new SmartPoolBuilder(this.signers.default, this.PCappedSmartPool);
        const pool = await poolBuilder.build(poolAddr);
        this.pools.push(pool);
        pool.print(implementation);
      } else if (
        implementation === "0x706F00ea85a71EB5d7C2ce2aD61DbBE62b616435" ||
        implementation === "0x706F00ea85a71EB5d7C2ce2aD61DbBE62b616435"
      ) {
        const poolBuilder = new SmartPoolBuilder(this.signers.default, this.pV2SmartPool);
        const pool = await poolBuilder.build(poolAddr);
        this.pools.push(pool);
        pool.print(implementation);
      }
    }
  });

  describe("PoolRegistry", function () {
    beforeEach(async function () {});

    shouldMigrateFromSmartPool();
  });
});
