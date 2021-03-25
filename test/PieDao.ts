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
    for (let i = 0; i < 6; i++) {
      const poolAddr = await this.smartPoolRegistry.connect(this.signers.default).entries(i);
      // const pool = await hre.ethers.getVerifiedContractAt(poolAddr);
      const proxy = await hre.ethers.getVerifiedContractAt(poolAddr);
      const implementation = await proxy.connect(this.signers.default).getImplementation();
      const pool = (await hre.ethers.getVerifiedContractAt(implementation)) as PCappedSmartPool;
      pool.attach(proxy.address);
      expect(await this.smartPoolRegistry.connect(this.signers.default).inRegistry(poolAddr)).to.eq(true);
      this.pools.push(pool);
      console.log("PieDaoPool ", i, ": ", poolAddr);
      console.log("Total supply: ", (await pool.connect(this.signers.admin).totalSupply()).toString());
    }
  });

  describe("PoolRegistry", function () {
    beforeEach(async function () {});

    shouldMigrateFromSmartPool();
  });
});
