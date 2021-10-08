import hardhat = require("hardhat")
import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20, IERC20__factory, IStrategy__factory, LiquidityMigration } from "../typechain";

import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { FACTORY_REGISTRIES, TOKENSET_ISSUANCE_MODULES, WETH, SUSD, DIVISOR, STRATEGY_STATE, UNISWAP_V3_ROUTER } from "../src/constants";
import { setupStrategyItems, estimateTokens, encodeStrategyData } from "../src/utils"
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer, ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";


describe("DPI: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    // this.abi = (await hardhat.artifacts.readArtifact("LiquidityMigration")).abi
    // console.log(this.abi)

    this.enso = await new EnsoBuilder(this.signers.admin).mainnet().build();

    // KNC not on Uniswap, use Chainlink
    await this.enso.platform.oracles.protocols.chainlinkOracle.connect(this.signers.admin).addOracle(SUSD, WETH, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', true); //sUSD
    await this.enso.platform.oracles.protocols.chainlinkOracle.connect(this.signers.admin).addOracle('0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202', SUSD, '0xf8ff43e991a81e6ec886a3d281a2c6cc19ae70fc', false); //KNC
    await this.enso.platform.strategyFactory.connect(this.signers.admin).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.SYNTH, '0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202') //Synth estimator uses Chainlink, but otherwise will be treated like a basic token


    this.DPIEnv = await new TokenSetEnvironmentBuilder(this.signers.default, this.enso).connect(
      FACTORY_REGISTRIES.DPI,
    );

    console.log(`DPI Adapter: ${this.DPIEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.enso);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.DefiPulseIndex, this.DPIEnv.adapter);
    const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
    if (liquitityMigrationDeployed != undefined) {
      console.log(`Liquidity Migration: ${liquitityMigrationDeployed.address}`);
    } else {
      console.log(`Liquidity Migration is undefined`);
    }

    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;
  });

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of DPI Tokens

    const holderBalances: any[] = [];
    for (let i = 0; i < this.DPIEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.DPIEnv.holders[i].getAddress(),
        balance: await this.DPIEnv.tokenSet.balanceOf(await this.DPIEnv.holders[i].getAddress()),
      };
      expect(await this.DPIEnv.tokenSet.balanceOf(await this.DPIEnv.holders[i].getAddress())).to.gt(BigNumber.from(0));
    }

    // getting the underlying tokens
    const underlyingTokens = await this.DPIEnv.tokenSet.getComponents();

    // redeeming the token
    const setBasicIssuanceModule = this.DPIEnv.setBasicIssuanceModule;
    const addressWhoIsRedeeming = await this.DPIEnv.holders[0].getAddress();
    const address_toWhom = addressWhoIsRedeeming;
    const tokenBalance = holderBalances[0].balance;
    const tokenContract = IERC20__factory.connect(underlyingTokens[0], this.DPIEnv.holders[0]) as IERC20;
    const previousUnderlyingTokenBalance = await tokenContract.balanceOf(addressWhoIsRedeeming);
    const tx = await setBasicIssuanceModule
      .connect(this.DPIEnv.holders[0])
      .redeem(this.DPIEnv.tokenSet.address, tokenBalance, address_toWhom);
    await tx.wait();
    const updatedDPIBalance = await this.DPIEnv.tokenSet.balanceOf(address_toWhom);
    const updatedUnderlyingTokenBalance = await tokenContract.balanceOf(addressWhoIsRedeeming);
    expect(updatedDPIBalance).to.equal(BigNumber.from(0));
    expect(updatedUnderlyingTokenBalance.gt(previousUnderlyingTokenBalance)).to.be.true;
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.DPIEnv.adapter
      .connect(this.signers.default)
      .add(FACTORY_REGISTRIES.DPI);
    await tx.wait();
    const holder2 = await this.DPIEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.DPIEnv.tokenSet.balanceOf(holder2Address);
    expect(holder2Balance).to.be.gt(BigNumber.from(0));
    await this.DPIEnv.tokenSet.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.DPIEnv.tokenSet.address, holder2Balance.div(2), this.DPIEnv.adapter.address);
    expect(await this.liquidityMigration.staked(holder2Address, this.DPIEnv.tokenSet.address)).to.equal(
      holder2Balance.div(2),
    );
    const holder2AfterBalance = await this.DPIEnv.tokenSet.balanceOf(holder2Address);
    expect(holder2AfterBalance).to.be.gt(BigNumber.from(0));
  });

  it("Should not be able to migrate tokens if the DPI token is not whitelisted in the DPI Adapter", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder2 = await this.DPIEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.DPIEnv.tokenSet.balanceOf(holder2Address);
    expect(holder2BalanceBefore).to.be.gt(BigNumber.from(0));
    await this.DPIEnv.tokenSet.connect(holder2).approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.DPIEnv.tokenSet.address, holder2BalanceBefore, this.DPIEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.DPIEnv.tokenSet.address);
    expect(amount).to.be.gt(BigNumber.from(0));

    // const holder2BalanceAfter = await this.DPIEnv.tokenSet.balanceOf(holder2Address);
    // expect(holder2BalanceAfter).to.be.equal(BigNumber.from(0));

    // Setup migration calls using DPIAdapter contract
    const migrationCalls: Multicall[] = await this.DPIEnv.adapter.encodeWithdraw(this.DPIEnv.tokenSet.address, amount);
    // // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    const underlyingTokens = await this.DPIEnv.tokenSet.getComponents();
    for (let i = 0; i < underlyingTokens.length; i++) {
      transferCalls.push(await encodeSettleTransfer(routerContract, underlyingTokens[i], ethers.constants.AddressZero));
    }
    // // Encode multicalls for GenericRouter
    const calls: Multicall[] = [...migrationCalls, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);

    const tx = await this.DPIEnv.adapter
      .connect(this.signers.default)
      .remove(FACTORY_REGISTRIES.DPI);
    await tx.wait();
    // // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        ['migrate(address,address,address,bytes)'](
          this.DPIEnv.tokenSet.address,
          this.DPIEnv.adapter.address,
          ethers.constants.AddressZero,
          migrationData
        ),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the DPI Token as a whitelisted token
    await expect(this.DPIEnv.adapter.connect(this.signers.admin).add(FACTORY_REGISTRIES.DPI))
      .to.be.reverted;
  });

  it("Getting the output token list", async function () {
    const underlyingTokens = await this.DPIEnv.tokenSet.getComponents();
    const outputTokens = await this.DPIEnv.adapter.outputTokens(FACTORY_REGISTRIES.DPI);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder3 = await this.DPIEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    await expect(this.DPIEnv.adapter.encodeWithdraw(holder3Address, BigNumber.from(100))).to.be.revertedWith("Whitelistable#onlyWhitelisted: not whitelisted lp");
  });

  it("Create strategy", async function () {
      // adding the DPI Token as a whitelisted token
      let tx = await this.DPIEnv.adapter
        .connect(this.signers.default)
        .add(FACTORY_REGISTRIES.DPI);
      await tx.wait();

      // getting the underlying tokens from DPI
      const underlyingTokens = await this.DPIEnv.tokenSet.getComponents();
      // deploy strategy
      const strategyData = encodeStrategyData(
        this.signers.default.address,
        "DPI",
        "DPI",
        await setupStrategyItems(this.enso.platform.oracles.ensoOracle, this.enso.adapters.uniswap.contract.address, this.DPIEnv.tokenSet.address, underlyingTokens),
        STRATEGY_STATE,
        ethers.constants.AddressZero,
        '0x'
      )
      tx = await this.liquidityMigration.createStrategy(
        this.DPIEnv.tokenSet.address,
        this.DPIEnv.adapter.address,
        strategyData
      );
      const receipt = await tx.wait();
      const strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
      console.log("Strategy address: ", strategyAddress);
      this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  })

  it("Should migrate tokens to strategy", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder3 = await this.DPIEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.DPIEnv.tokenSet.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.DPIEnv.tokenSet.connect(holder3).approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stake(this.DPIEnv.tokenSet.address, holder3BalanceBefore, this.DPIEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder3Address, this.DPIEnv.tokenSet.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.DPIEnv.tokenSet.balanceOf(holder3Address);
    expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));

    const migrationCalls: Multicall[] = await this.DPIEnv.adapter.encodeWithdraw(this.DPIEnv.tokenSet.address, amount);

    // // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    const underlyingTokens = await this.DPIEnv.tokenSet.getComponents();
    for (let i = 0; i < underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, underlyingTokens[i], this.strategy.address));
    }
    // // Encode multicalls for GenericRouter
    const calls: Multicall[] = [...migrationCalls, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    // // Migrate
    await this.liquidityMigration
      .connect(holder3)
      ['migrate(address,address,address,bytes)'](
        this.DPIEnv.tokenSet.address,
        this.DPIEnv.adapter.address,
        this.strategy.address,
        migrationData
      );
    const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, this.strategy.address, underlyingTokens);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  });

  it("Should buy and stake", async function () {
    const defaultAddress = await this.signers.default.getAddress();

    expect(await this.DPIEnv.tokenSet.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.strategy.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.liquidityMigration.staked(defaultAddress, this.DPIEnv.tokenSet.address)).to.be.eq(BigNumber.from(0));

    const ethAmount = ethers.constants.WeiPerEther
    const expectedAmount = await this.DPIEnv.adapter.callStatic.getAmountOut(this.DPIEnv.tokenSet.address, UNISWAP_V3_ROUTER, ethAmount)
    console.log("Expected: ", expectedAmount.toString())

    await this.liquidityMigration.connect(this.signers.default).buyAndStake(
      this.DPIEnv.tokenSet.address,
      this.DPIEnv.adapter.address,
      UNISWAP_V3_ROUTER,
      expectedAmount.mul(995).div(1000), //0.5% slippage
      ethers.constants.MaxUint256,
      {value: ethAmount}
    )

    const staked = await this.liquidityMigration.staked(defaultAddress, this.DPIEnv.tokenSet.address)
    console.log("Staked: ", staked.toString())
    expect(staked).to.be.gt(BigNumber.from(0));
  })

  it("BatchAdd and BatchRemove for Whitelistable", async function () {
    const tx = await this.DPIEnv.adapter
      .connect(this.signers.default)
      .addBatch([FACTORY_REGISTRIES.DPI, FACTORY_REGISTRIES.ETH_USD_YIELD]);
    await tx.wait();
    expect(await this.DPIEnv.adapter.connect(this.signers.default).isWhitelisted(FACTORY_REGISTRIES.DPI)).to.be.true;
    expect(await this.DPIEnv.adapter.connect(this.signers.default).isWhitelisted(FACTORY_REGISTRIES.ETH_USD_YIELD)).to.be.true;

    const tx2 = await this.DPIEnv.adapter
      .connect(this.signers.default)
      .removeBatch([FACTORY_REGISTRIES.DPI, FACTORY_REGISTRIES.ETH_USD_YIELD]);
    await tx2.wait();
    expect(await this.DPIEnv.adapter.connect(this.signers.default).isWhitelisted(FACTORY_REGISTRIES.DPI)).to.be.false;
    expect(await this.DPIEnv.adapter.connect(this.signers.default).isWhitelisted(FACTORY_REGISTRIES.ETH_USD_YIELD)).to.be.false;
  })
});
