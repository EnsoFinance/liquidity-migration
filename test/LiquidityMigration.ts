import { ethers } from "hardhat";
import { expect } from "chai";
import { constants } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory, IStrategy__factory } from "../typechain";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { EnsoBuilder } from "@enso/contracts";

describe("Liquidity Migration", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];
    this.underlyingTokens = [];
    this.enso = await new EnsoBuilder(this.signers.admin).mainnet().build();
    this.IndexedEnv = await new IndexedEnvironmentBuilder(this.signers.default).connect();
    this.indexedErc20 = IERC20__factory.connect(this.IndexedEnv.pool.address, this.signers.default);
    const liquidityMigrationBuilder = new LiquidityMigrationBuilder(this.signers.admin, this.enso);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Indexed, this.IndexedEnv.adapter);
    this.liquidityMigration = (await liquidityMigrationBuilder.deploy()).liquidityMigration;
    this.underlyingTokens = await this.IndexedEnv.adapter.outputTokens(this.IndexedEnv.pool.address);
  });

  beforeEach(async function () {
    this.newAddress = ethers.Wallet.createRandom().address;
  });

  it("Update controller", async function () {
    const controller = await this.liquidityMigration.controller();
    expect(controller).to.not.eq(constants.AddressZero);
    expect(controller).to.not.eq(this.newAddress);
    const tx = await this.liquidityMigration.updateController(this.newAddress);
    await tx.wait();
    expect(await this.liquidityMigration.controller()).to.eq(this.newAddress);
  });

  it("Update generic", async function () {
    const generic = await this.liquidityMigration.generic();
    expect(generic).to.not.eq(constants.AddressZero);
    expect(generic).to.not.eq(this.newAddress);
    const tx = await this.liquidityMigration.updateGeneric(this.newAddress);
    await tx.wait();
    expect(await this.liquidityMigration.generic()).to.eq(this.newAddress);
  });

  it("Update factory", async function () {
    const factory = await this.liquidityMigration.factory();
    expect(factory).to.not.eq(constants.AddressZero);
    expect(factory).to.not.eq(this.newAddress);
    const tx = await this.liquidityMigration.updateFactory(this.newAddress);
    await tx.wait();
    expect(await this.liquidityMigration.factory()).to.eq(this.newAddress);
  });
});
