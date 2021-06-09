import { ethers } from "hardhat";
import { Contract } from "ethers";
import { Signers, MainnetSigner } from "../types";
import { shouldMigrateFromSmartPool, shouldCreateStrategy } from "./PieDao.behavior";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration"
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { EnsoEnvironment } from "@enso/contracts"

describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    this.strategy = {} as Contract;
    this.liquidityMigration = {} as Contract;
    this.enso = {} as EnsoEnvironment

    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    this.pieDaoEnv = await new PieDaoEnvironmentBuilder(this.signers.default).connect()

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin)
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.PieDao, this.pieDaoEnv.adapter)
    await liquidityMigrationBuilder.deploy()

    this.enso = liquidityMigrationBuilder.enso
    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration
  });

  describe("PoolRegistry", function () {
    shouldMigrateFromSmartPool();
  });

  describe("Strategy", function () {
    shouldCreateStrategy();
  })
});
