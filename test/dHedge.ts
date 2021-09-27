import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory, IStrategy__factory } from "../typechain";

import { DHedgeEnvironmentBuilder } from "../src/dhedge";
import { FACTORY_REGISTRIES, WETH, SUSD, DIVISOR, STRATEGY_STATE, UNISWAP_ROUTER } from "../src/constants";
import { setupStrategyItems, estimateTokens, encodeStrategyData } from "../src/utils"
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer, ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";

describe("dHedge: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];
    this.underlyingTokens = [];

    this.enso = await new EnsoBuilder(this.signers.admin).mainnet().build();
    const chainlinkOracle = this.enso.platform.oracles.protocols.chainlinkOracle

    this.DHedgeEnv = await new DHedgeEnvironmentBuilder(this.signers.default).connect();
    this.dHedgeTopIndexERC20 = IERC20__factory.connect(this.DHedgeEnv.dHedgeTopIndex.address, this.signers.default);

    console.log(`dHedge Adapter: ${this.DHedgeEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.enso);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.DHedge, this.DHedgeEnv.adapter);
    const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
    if (liquitityMigrationDeployed != undefined) {
      console.log(`Liquidity Migration: ${liquitityMigrationDeployed.address}`);
    } else {
      console.log(`Liquidity Migration is undefined`);
    }

    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;

    // getting the underlying tokens from dHedge Top
    this.underlyingTokens = await this.DHedgeEnv.adapter.outputTokens(this.DHedgeEnv.dHedgeTopIndex.address);

    const sETH = '0x5e74c9036fb86bd7ecdcb084a0673efc32ea31cb'
    const sAAVE = '0xd2df355c19471c8bd7d8a3aa27ff4e26a21b4076'
    const sBTC = '0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6'
    const sDOT = '0x1715ac0743102bf5cd58efbb6cf2dc2685d967b6'
    const sADA = '0xe36e2d3c7c34281fa3bc737950a68571736880a1'

    // setup chainlink oracle
    await chainlinkOracle.connect(this.signers.admin).addOracle(SUSD, WETH, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', true); //sUSD
		await chainlinkOracle.connect(this.signers.admin).addOracle(sETH, SUSD, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', false); //sETH
    await chainlinkOracle.connect(this.signers.admin).addOracle(sAAVE, WETH, '0x6df09e975c830ecae5bd4ed9d90f3a95a4f88012', false); //sAAVE
    await chainlinkOracle.connect(this.signers.admin).addOracle(sBTC, WETH, '0xdeb288f737066589598e9214e782fa5a8ed689e8', false); //sBTC
    await chainlinkOracle.connect(this.signers.admin).addOracle(sDOT, SUSD, '0x1c07afb8e2b827c5a4739c6d59ae3a5035f28734', false); //sDOT
    await chainlinkOracle.connect(this.signers.admin).addOracle(sADA, SUSD, '0xae48c91df1fe419994ffda27da09d5ac69c30f55', false); //sADA

    // setup synth estimator
    await this.enso.platform.strategyFactory.connect(this.signers.admin).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, sETH)
    await this.enso.platform.strategyFactory.connect(this.signers.admin).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, sAAVE)
    await this.enso.platform.strategyFactory.connect(this.signers.admin).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, sBTC)
    await this.enso.platform.strategyFactory.connect(this.signers.admin).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, sDOT)
    await this.enso.platform.strategyFactory.connect(this.signers.admin).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, sADA)
  });

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of dHedge Top Tokens
    const holderBalances: any[] = [];

    for (let i = 0; i < this.DHedgeEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.DHedgeEnv.holders[i].getAddress(),
        balance: await this.dHedgeTopIndexERC20.balanceOf(await this.DHedgeEnv.holders[i].getAddress()),
      };
      expect(await this.dHedgeTopIndexERC20.balanceOf(await this.DHedgeEnv.holders[i].getAddress())).to.gt(
        BigNumber.from(0),
      );
    }

    const previoustokenBalance = holderBalances[0].balance;
    expect(previoustokenBalance.gt(BigNumber.from(0))).to.be.true;
    // creating the minAmountsOut array
    const tx = await this.DHedgeEnv.dHedgeTopIndex
      .connect(this.DHedgeEnv.holders[0])
      .withdraw(previoustokenBalance);
    await tx.wait();
    const posttokenBalance = await this.dHedgeTopIndexERC20.balanceOf(
      await this.DHedgeEnv.holders[0].getAddress(),
    );
    expect(posttokenBalance.isZero()).to.be.true;
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.DHedgeEnv.adapter
      .connect(this.signers.default)
      .add(FACTORY_REGISTRIES.DHEDGE_TOP);
    await tx.wait();
    const holder2 = await this.DHedgeEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.dHedgeTopIndexERC20.balanceOf(holder2Address);
    expect(holder2Balance.gt(BigNumber.from(0))).to.be.true;
    await this.dHedgeTopIndexERC20.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.DHedgeEnv.dHedgeTopIndex.address, holder2Balance.div(3), this.DHedgeEnv.adapter.address);
    expect(
      (await this.liquidityMigration.staked(holder2Address, this.DHedgeEnv.dHedgeTopIndex.address)).eq(
        holder2Balance.div(3),
      ),
    ).to.be.true;
    const holder2AfterBalance = await this.dHedgeTopIndexERC20.balanceOf(holder2Address);
    expect(holder2AfterBalance.gt(BigNumber.from(0))).to.be.true;
  });

  it("Should not be able to migrate tokens if the dTop token is not whitelisted in the DHedge Adapter", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder2 = await this.DHedgeEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.dHedgeTopIndexERC20.balanceOf(holder2Address);
    expect(holder2BalanceBefore.gt(BigNumber.from(0))).to.be.true;
    await this.dHedgeTopIndexERC20
      .connect(holder2)
      .approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.DHedgeEnv.dHedgeTopIndex.address, holder2BalanceBefore, this.DHedgeEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.DHedgeEnv.dHedgeTopIndex.address);
    expect(amount.gt(BigNumber.from(0))).to.be.true;

    const holder2BalanceAfter = await this.dHedgeTopIndexERC20.balanceOf(holder2Address);
    expect(holder2BalanceAfter.eq(BigNumber.from(0))).to.be.true;
    // Setup migration calls using DHedgeAdapter contract
    const migrationCall: Multicall = await this.DHedgeEnv.adapter.encodeWithdraw(this.DHedgeEnv.dHedgeTopIndex.address, amount);
    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    // TODO: Dipesh to discuss the follwoing with Peter why do we need the transferCalls array
    for (let i = 0; i < this.underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, this.underlyingTokens[i], ethers.constants.AddressZero)); // Strategy doesn't matter right now
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [migrationCall, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    const tx = await this.DHedgeEnv.adapter
      .connect(this.signers.default)
      .remove(FACTORY_REGISTRIES.DHEDGE_TOP);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        ['migrate(address,address,address,bytes)']
        (
          this.DHedgeEnv.dHedgeTopIndex.address,
          this.DHedgeEnv.adapter.address,
          ethers.constants.AddressZero, // Strategy doesn't matter right now
          migrationData
        ),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the DHedge Token as a whitelisted token
    await expect(
      this.DHedgeEnv.adapter.connect(this.signers.admin).add(FACTORY_REGISTRIES.DHEDGE_TOP),
    ).to.be.reverted;
  });

  it("Getting the output token list", async function () {
    // adding the dHedge Top Token as a whitelisted token
    const [underlyingAssets, , ] = await this.DHedgeEnv.dHedgeTopIndex.getFundComposition();
    const underlyingTokens = await Promise.all(underlyingAssets.map((asset: string) => this.DHedgeEnv.dHedgeTopIndex.getAssetProxy(asset)))
    const outputTokens = await this.DHedgeEnv.adapter.outputTokens(FACTORY_REGISTRIES.DHEDGE_TOP);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Encode withdraw using a non-whitelisted token should fail", async function () {
    // Setup migration calls using DHedgeAdapter contract
    await expect(this.DHedgeEnv.adapter.encodeWithdraw(this.DHedgeEnv.dHedgeTopIndex.address, BigNumber.from(10000))).to.be.revertedWith(
      "Whitelistable#onlyWhitelisted: not whitelisted lp",
    );
  });

  it("Create strategy", async function () {
      // adding the dHedge Top Token as a whitelisted token
      let tx = await this.DHedgeEnv.adapter
        .connect(this.signers.default)
        .add(FACTORY_REGISTRIES.DHEDGE_TOP);
      await tx.wait();

      // deploy strategy
      const strategyData = encodeStrategyData(
        this.signers.default.address,
        "dHedge Top Index",
        "DTOP",
        await setupStrategyItems(this.enso.platform.oracles.ensoOracle, this.enso.adapters.uniswap.contract.address, this.DHedgeEnv.dHedgeTopIndex.address, this.underlyingTokens),
        STRATEGY_STATE,
        ethers.constants.AddressZero,
        '0x'
      )
      tx = await this.liquidityMigration.createStrategy(
        this.DHedgeEnv.dHedgeTopIndex.address,
        this.DHedgeEnv.adapter.address,
        strategyData
      );
      const receipt = await tx.wait();
      const strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
      console.log("Strategy address: ", strategyAddress);
      this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  })

  it("Should migrate tokens to strategy", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder3 = await this.DHedgeEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.dHedgeTopIndexERC20.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.dHedgeTopIndexERC20
      .connect(holder3)
      .approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stake(this.DHedgeEnv.dHedgeTopIndex.address, holder3BalanceBefore, this.DHedgeEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder3Address, this.DHedgeEnv.dHedgeTopIndex.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.dHedgeTopIndexERC20.balanceOf(holder3Address);
    expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));
    // Setup migration calls using DHedgeAdapter contract
    const migrationCall: Multicall = await this.DHedgeEnv.adapter.encodeWithdraw(this.DHedgeEnv.dHedgeTopIndex.address, amount);

    // // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    const underlyingTokens = await this.DHedgeEnv.adapter.outputTokens(FACTORY_REGISTRIES.DHEDGE_TOP);
    for (let i = 0; i < underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, underlyingTokens[i], this.strategy.address));
    }
    // // Encode multicalls for GenericRouter
    const calls: Multicall[] = [migrationCall, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    // // Migrate
    await this.liquidityMigration
      .connect(holder3)
      ['migrate(address,address,address,bytes)']
      (
        this.DHedgeEnv.dHedgeTopIndex.address,
        this.DHedgeEnv.adapter.address,
        this.strategy.address,
        migrationData
      );
    const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, this.strategy.address, underlyingTokens);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  });
  /*
  it("Should buy and stake", async function () {
    const defaultAddress = await this.signers.default.getAddress();

    // staking the tokens in the liquidity migration contract
    const indexBalance = await this.dHedgeTopIndexERC20.balanceOf(defaultAddress);
    const strategyBalance = await this.strategy.balanceOf(defaultAddress);
    expect(indexBalance).to.be.eq(BigNumber.from(0));
    expect(strategyBalance).to.be.eq(BigNumber.from(0));

    const ethAmount = ethers.constants.WeiPerEther
    const expectedAmount = await this.DHedgeEnv.adapter.getAmountOut(this.DHedgeEnv.dHedgeTopIndex.address, UNISWAP_ROUTER, ethAmount)
    console.log("Expected: ", expectedAmount.toString())

    await this.liquidityMigration.connect(this.signers.default).buyAndStake(
      this.DHedgeEnv.dHedgeTopIndex.address,
      this.DHedgeEnv.adapter.address,
      UNISWAP_ROUTER,
      expectedAmount.mul(995).div(1000), //0.5% slippage
      ethers.constants.MaxUint256,
      {value: ethAmount}
    )

    const staked = await this.liquidityMigration.staked(defaultAddress, this.DPIEnv.tokenSet.address)
    expect(staked).to.be.gt(BigNumber.from(0));
  })
  */
});
