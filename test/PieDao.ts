import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { ERC20__factory, IStrategy__factory } from "../typechain";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer } from "@enso/contracts";
import { WETH, DIVISOR, STRATEGY_STATE } from "../src/constants";

describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    this.ensoEnv = await new EnsoBuilder(this.signers.admin).mainnet().build();

    this.pieDaoEnv = await new PieDaoEnvironmentBuilder(this.signers.default).connect();

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.ensoEnv);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.PieDao, this.pieDaoEnv.adapter);
    await liquidityMigrationBuilder.deploy();

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
    if (positions.findIndex(pos => pos.token.toLowerCase() == WETH.toLowerCase()) == -1) {
      positions.push({
        token: WETH,
        percentage: BigNumber.from(0),
      });
    }

    // TODO: NOTE, this is version 2
    const strategyItems = prepareStrategy(positions, this.ensoEnv.adapters.uniswap.contract.address);

    const tx = await this.ensoEnv.platform.strategyFactory.createStrategy(
      this.signers.default.address,
      "PieDao",
      "PIE",
      strategyItems,
      STRATEGY_STATE,
      ethers.constants.AddressZero,
      '0x',
    );
    const receipt = await tx.wait();
    const strategyAddress = receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
    console.log("Strategy address: ", strategyAddress);
    this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  });

  it("Token holder should be able to stake LP token", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const contract = await pool.contract;

    const tx = await this.pieDaoEnv.adapter
      .connect(this.signers.default)
      .add(contract.address);
    await tx.wait();

    const holder = pool.holders[0];
    const holderAddress = await holder.getAddress();
    const holderBalance = await contract.balanceOf(holderAddress);
    expect(holderBalance).to.be.gt(BigNumber.from(0));
    await contract.connect(holder).approve(this.liquidityMigration.address, holderBalance);

    await this.liquidityMigration
      .connect(holder)
      .stake(contract.address, holderBalance, this.pieDaoEnv.adapter.address);
    expect(await this.liquidityMigration.staked(holderAddress, contract.address)).to.equal(holderBalance);
  });

  it("Should migrate tokens to strategy", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const poolContract = await pool.contract;
    const routerContract = this.ensoEnv.routers[0].contract;

    const holder = pool.holders[0];
    const holderAddress = await holder.getAddress();
    const amount = await this.liquidityMigration.staked(holderAddress, poolContract.address);

    // Setup migration calls using PieDaoAdapter contract
    const migrationCall: Multicall = await this.pieDaoEnv.adapter.encodeWithdraw(poolContract.address, amount);
    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    for (let i = 0; i < pool.tokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, pool.tokens[i], this.strategy.address));
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [migrationCall, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    // Migrate
    await this.liquidityMigration
      .connect(holder)
      ['migrate(address,address,address,bytes)'](
        poolContract.address,
        this.pieDaoEnv.adapter.address,
        this.strategy.address,
        migrationData
      );
    const [total] = await this.ensoEnv.enso.uniswapOracle.estimateTotal(this.strategy.address, pool.tokens);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holderAddress)).to.gt(0);
  });

  it("Getting the output token list", async function () {
    const underlyingTokens = await this.pieDaoEnv.pools[0].contract.getTokens();
    const outputTokens = await this.pieDaoEnv.adapter.outputTokens(this.pieDaoEnv.pools[0].contract.address);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

});
