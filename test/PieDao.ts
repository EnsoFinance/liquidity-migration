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
const { Contract } = ethers;

class SmartPoolBuilder {
  signer: Signer;
  contract: PCappedSmartPool;
  controller?: string;
  supply?: BigNumber;

  constructor(signer: Signer, contract: PCappedSmartPool) {
    this.contract = contract;
    this.signer = signer;
  }

  async build(address: string) {
    const pool = this.contract.attach(address);
    // this.controller = await pool.connect(this.signer).getController();
    const tokens = await pool.connect(this.signer).getTokens();
    console.log('Tokens: ', tokens);
    console.log('Controller: ', this.controller);
    this.supply = await pool.connect(this.signer).totalSupply();
  }

  print() {
    console.log('SmartPool');
    console.log('Supply: ', this.supply?.toString());
  }
}

class SmartPool {
  contract: PCappedSmartPool;
  controller: string;
  supply: BigNumber;

  constructor(contract: PCappedSmartPool, controller: string, supply: BigNumber) {
    this.contract = contract;
    this.controller = controller;
    this.supply = supply;
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
    this.signers.admin = await new MainnetSigner(pieDaoAdmin).impersonateAccount();

    this.pools = [];
    this.poolImplementation = new SmartPoolBuilder(this.signers.default, (await hre.ethers.getVerifiedContractAt("0xf13f977AaC9B001f155889b9EFa7A6628Fb7a181")) as PCappedSmartPool);

    for (let i = 0; i < 6; i++) {
      const poolAddr = await this.smartPoolRegistry.connect(this.signers.default).entries(i);
      expect(await this.smartPoolRegistry.connect(this.signers.default).inRegistry(poolAddr)).to.eq(true);
      const pool = await this.poolImplementation.build(poolAddr);
      this.pools.push(pool);
      this.poolImplementation.print();
    }
  });

  describe("PoolRegistry", function () {
    beforeEach(async function () {});

    shouldMigrateFromSmartPool();
  });
});
