const hre = require("hardhat");
const { ethers } = hre;
import { Signers, MainnetSigner } from "../types";
import { shouldMigrateFromSmartPool } from "./PieDao.behavior";
import { LiquidityMigrationBuilder } from "../src/liquditymigration"
import { PieDaoEnvironmentBuilder } from "../src/piedao";


describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];

    this.liquidityMigration = await new LiquidityMigrationBuilder(this.signers.admin).mainnet();
    this.pieDaoEnv = await new PieDaoEnvironmentBuilder(this.signers.default).connect()

  });

  describe("PoolRegistry", function () {
    beforeEach(async function () {});

    shouldMigrateFromSmartPool();
  });
});
