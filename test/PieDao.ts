// import { ethers, hre } from "hardhat";
const hre = require("hardhat");
const { ethers } = hre;
import {
  SmartPoolRegistry,
  SmartPoolRegistry__factory,
  PCappedSmartPool__factory,
  PCappedSmartPool,
} from "../typechain";
import { Signers, MainnetSigner } from "../types";
import { shouldMigrateFromSmartPool } from "./PieDao.behavior";
import { PIE_DAO_REGISTRY } from "../src/constants";
import { expect } from "chai";
import { BigNumber, Signer } from "ethers";
const { ZERO_ADDRESS } = ethers;

class SmartPoolBuilder {
  signer: Signer;
  contract: PCappedSmartPool;
  controller?: string;
  supply?: BigNumber;
  tokens?: string[];
  name?: string;

  constructor(signer: Signer, contract: PCappedSmartPool) {
    this.contract = contract;
    this.signer = signer;
  }

  async getHolders(): Promise<string[]> {
    const transferEvents  = this.contract.filters.Transfer(ZERO_ADDRESS, null, null);
    console.log(transferEvents.topics?.values().next())
    // this.contract.on(transferEvents, (_src: string, _dst: string, _amount: BigNumber) => {
      // console.log(_src, _dst, _amount);
    // });
    return []
  }

  async build(address: string): Promise<SmartPool> {
    this.contract = this.contract.attach(address);
    this.controller = await this.contract.connect(this.signer).getController();
    this.tokens = await this.contract.connect(this.signer).getTokens();
    this.supply = await this.contract.connect(this.signer).totalSupply();
    this.name = await this.contract.connect(this.signer).name();
    await this.getHolders();
    return new SmartPool(this.contract, this.controller, this.supply, this.tokens, this.name);
  }
}

class SmartPool {
  contract: PCappedSmartPool;
  controller: string;
  supply: BigNumber;
  tokens: string[];
  name: string;

  constructor(contract: PCappedSmartPool, controller: string, supply: BigNumber, tokens: string[], name: string) {
    this.contract = contract;
    this.controller = controller;
    this.supply = supply;
    this.tokens = tokens;
    this.name = name;
  }

  print(implementation?: string) {
    console.log("SmartPool: ", this.name);
    console.log("  Address: ", this.contract.address);
    if (implementation) console.log("  Implementation: ", implementation);
    console.log("  Supply: ", this.supply?.toString());
    console.log("  Tokens: ", this.tokens);
    console.log("  Controller: ", this.controller);
    console.log("");
  }
}

describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];

    this.smartPoolRegistry = (await hre.ethers.getVerifiedContractAt(PIE_DAO_REGISTRY)) as SmartPoolRegistry;
    console.log("PieDaoRegistry: ", this.smartPoolRegistry.address);

    const pieDaoAdmin = await this.smartPoolRegistry.connect(this.signers.default).owner();
    this.signers.admin = await (new MainnetSigner(pieDaoAdmin)).impersonateAccount();

    this.pools = [];
    this.pV2SmartPool = await hre.ethers.getVerifiedContractAt("0x706F00ea85a71EB5d7C2ce2aD61DbBE62b616435");
    this.PCappedSmartPool = (await hre.ethers.getVerifiedContractAt(
      "0xf13f977AaC9B001f155889b9EFa7A6628Fb7a181",
    )) as PCappedSmartPool;

    for (let i = 0; i < 6; i++) {
      const poolAddr = await this.smartPoolRegistry.connect(this.signers.default).entries(i);
      expect(await this.smartPoolRegistry.connect(this.signers.default).inRegistry(poolAddr)).to.eq(true);
      const proxy = await hre.ethers.getVerifiedContractAt(poolAddr);
      const implementation = await proxy.connect(this.signers.default).getImplementation();
      if (implementation === "0xf13f977AaC9B001f155889b9EFa7A6628Fb7a181") {
        const poolBuilder = new SmartPoolBuilder(this.signers.default, this.pV2SmartPool);
        const pool = await poolBuilder.build(poolAddr);
        this.pools.push(pool);
        pool.print(implementation);
      } else {
        console.log("implementation ", implementation);
      }
    }
  });

  describe("PoolRegistry", function () {
    beforeEach(async function () {});

    shouldMigrateFromSmartPool();
  });
});
