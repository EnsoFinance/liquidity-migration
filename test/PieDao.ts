import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { ERC20__factory, IStrategy__factory } from "../typechain";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { StrategyBuilder, Position, Multicall, encodeSettleTransfer } from "@enso/contracts";
import { DIVISOR, THRESHOLD, TIMELOCK, SLIPPAGE } from "../src/constants";

describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    this.pieDaoEnv = await new PieDaoEnvironmentBuilder(this.signers.default).connect();

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.PieDao, this.pieDaoEnv.adapter);
    await liquidityMigrationBuilder.deploy();

    this.ensoEnv = liquidityMigrationBuilder.enso;
    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;

    // Create strategy
    const pool = this.pieDaoEnv.pools[0];

    const positions = [] as Position[];
    for (let i = 0; i < pool.tokens.length; i++) {
      positions.push({
        token: pool.tokens[i],
        percentage: BigNumber.from(DIVISOR).div(pool.tokens.length),
      });
    }

    // TODO: NOTE, this is version 2
    const s = new StrategyBuilder(positions, this.ensoEnv.adapters.uniswap.contract.address);

    const data = ethers.utils.defaultAbiCoder.encode(["address[]", "address[]"], [s.tokens, s.adapters]);
    const tx = await this.ensoEnv.enso.strategyFactory.createStrategy(
      this.liquidityMigration.address, //Because strategies can't be social without initial deposit, must make LiquidityMigration contract manager
      "PieDao",
      "PIE",
      s.tokens,
      s.percentages,
      false, //Cannot open strategy without first depositing
      0,
      THRESHOLD,
      SLIPPAGE,
      TIMELOCK,
      this.ensoEnv.routers[1].contract.address,
      data,
    );
    const receipt = await tx.wait();
    const strategyAddress = receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
    console.log("Strategy address: ", strategyAddress);
    this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  });

  it("Token holder should be able to stake LP token", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const contract = await pool.contract;
    const holder = pool.holders[0];
    const holderAddress = await holder.getAddress();

    const holderBalance = await contract.balanceOf(holderAddress);
    expect(holderBalance).to.be.gt(BigNumber.from(0));
    await contract.connect(holder).approve(this.liquidityMigration.address, holderBalance);
    await this.liquidityMigration
      .connect(holder)
      .stakeLpTokens(contract.address, holderBalance, AcceptedProtocols.PieDao);
    expect(((await this.liquidityMigration.getStake(holderAddress, contract.address)).amount).eq(holderBalance)).to.be.true;
    expect((await this.liquidityMigration.stakes(holderAddress, contract.address))[0]).to.equal(holderBalance);
  });

  it("Should migrate tokens to strategy", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const poolContract = await pool.contract;
    const routerContract = this.ensoEnv.routers[0].contract;

    const holder = pool.holders[0];
    const holderAddress = await holder.getAddress();
    const amount = (await this.liquidityMigration.stakes(holderAddress, poolContract.address))[0];

    // Setup migration calls using PieDaoAdapter contract
    const adapterData = ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [poolContract.address, amount]);
    const migrationCalls: Multicall[] = await this.pieDaoEnv.adapter.encodeExecute(adapterData);
    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    for (let i = 0; i < pool.tokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, pool.tokens[i], this.strategy.address));
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [...migrationCalls, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    // Migrate
    await this.liquidityMigration
      .connect(holder)
      .migrate(this.strategy.address, poolContract.address, AcceptedProtocols.PieDao, migrationData, 0);
    const [total] = await this.ensoEnv.enso.oracle.estimateTotal(this.strategy.address, pool.tokens);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holderAddress)).to.gt(0);
  });

  it("Getting the output token list", async function () {
    const underlyingTokens = await this.pieDaoEnv.pools[0].contract.getTokens();
    const outputTokens = await this.pieDaoEnv.adapter.outputTokens(this.pieDaoEnv.pools[0].contract.address);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

});
