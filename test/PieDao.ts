import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { ERC20__factory, IStrategy__factory } from "../typechain";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer } from "@enso/contracts";
import { WETH, DIVISOR, STRATEGY_STATE, UNISWAP_ROUTER } from "../src/constants";
import { setupStrategyItems, estimateTokens } from "../src/utils"

describe("PieDao: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    this.enso = await new EnsoBuilder(this.signers.admin).mainnet().build();

    this.pieDaoEnv = await new PieDaoEnvironmentBuilder(this.signers.default).connect();

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.enso);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.PieDao, this.pieDaoEnv.adapter);
    await liquidityMigrationBuilder.deploy();

    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;

    // Create strategy
    const pool = this.pieDaoEnv.pools[0];
    console.log("Pool: ", await pool.contract.getBPool())

    const tx = await this.enso.platform.strategyFactory.createStrategy(
      this.signers.default.address,
      "PieDao",
      "PIE",
      await setupStrategyItems(this.enso.platform.oracles.ensoOracle, this.enso.adapters.uniswap.contract.address, await pool.contract.getBPool(), pool.tokens),
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

    const totalSupply = await pool.contract.totalSupply()
    console.log("Holder percent:", holderBalance.mul(1000).div(totalSupply).toString())

    await this.liquidityMigration
      .connect(holder)
      .stake(contract.address, holderBalance, this.pieDaoEnv.adapter.address);
    expect(await this.liquidityMigration.staked(holderAddress, contract.address)).to.equal(holderBalance);
  });

  it("Should migrate tokens to strategy", async function () {
    const pool = this.pieDaoEnv.pools[0];
    const poolContract = await pool.contract;
    const routerContract = this.enso.routers[0].contract;

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
      ['migrate(address,address,address,bytes)']
      (
        poolContract.address,
        this.pieDaoEnv.adapter.address,
        this.strategy.address,
        migrationData
      );
    const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, this.strategy.address, pool.tokens);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holderAddress)).to.gt(0);
  });

  it("Getting the output token list", async function () {
    const underlyingTokens = await this.pieDaoEnv.pools[0].contract.getTokens();
    const outputTokens = await this.pieDaoEnv.adapter.outputTokens(this.pieDaoEnv.pools[0].contract.address);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Should buy and stake", async function () {
    const defaultAddress = await this.signers.default.getAddress();

    expect(await this.pieDaoEnv.pools[0].contract.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.strategy.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.liquidityMigration.staked(defaultAddress, this.pieDaoEnv.pools[0].contract.address)).to.be.eq(BigNumber.from(0));

    const ethAmount = ethers.constants.WeiPerEther
    const expectedAmount = await this.pieDaoEnv.adapter.getAmountOut(this.pieDaoEnv.pools[0].contract.address, UNISWAP_ROUTER, ethAmount)
    console.log("Expected: ", expectedAmount.toString())

    await this.liquidityMigration.connect(this.signers.default).buyAndStake(
      this.pieDaoEnv.pools[0].contract.address,
      this.pieDaoEnv.adapter.address,
      UNISWAP_ROUTER,
      expectedAmount.mul(995).div(1000), //0.5% slippage
      ethers.constants.MaxUint256,
      {value: ethAmount}
    )

    const staked = await this.liquidityMigration.staked(defaultAddress, this.pieDaoEnv.pools[0].contract.address)
    console.log("Staked: ", staked.toString())
    expect(staked).to.be.gt(BigNumber.from(0));
  })
});
