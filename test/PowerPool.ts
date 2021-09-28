import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory, IStrategy__factory } from "../typechain";
import { PowerpoolEnvironmentBuilder } from "../src/powerpool";
import { FACTORY_REGISTRIES, WETH, DIVISOR, STRATEGY_STATE, UNISWAP_V3_ROUTER } from "../src/constants";
import { setupStrategyItems, estimateTokens } from "../src/utils"
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";

describe("PowerPool: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];
    this.underlyingTokens = [];

    this.enso = await new EnsoBuilder(this.signers.admin).mainnet().build();

    this.PowerEnv = await new PowerpoolEnvironmentBuilder(this.signers.default).connect();
    this.powerIndexPoolERC20 = IERC20__factory.connect(this.PowerEnv.powerIndexPool.address, this.signers.default);

    console.log(`Powerpool Adapter: ${this.PowerEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.enso);


    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Powerpool, this.PowerEnv.adapter);
    const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
    if (liquitityMigrationDeployed != undefined) {
      console.log(`Liquidity Migration: ${liquitityMigrationDeployed.address}`);
    } else {
      console.log(`Liquidity Migration is undefined`);
    }

    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;

    // getting the underlying tokens from DEGEN
    this.underlyingTokens = await this.PowerEnv.adapter.outputTokens(this.PowerEnv.powerIndexPool.address);

    const tx = await this.enso.platform.strategyFactory.createStrategy(
      this.signers.default.address,
      "power",
      "power",
      await setupStrategyItems(this.enso.platform.oracles.ensoOracle, this.enso.adapters.uniswap.contract.address, this.PowerEnv.powerIndexPool.address, this.underlyingTokens),
      STRATEGY_STATE,
      ethers.constants.AddressZero,
      '0x',
    );
    const receipt = await tx.wait();
    const strategyAddress = receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
    console.log("Strategy address: ", strategyAddress);
    this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  });

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of DEGEN Tokens
    const holderBalances: any[] = [];

    for (let i = 0; i < this.PowerEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.PowerEnv.holders[i].getAddress(),
        balance: await this.powerIndexPoolERC20.balanceOf(await this.PowerEnv.holders[i].getAddress()),
      };
      expect(await this.powerIndexPoolERC20.balanceOf(await this.PowerEnv.holders[i].getAddress())).to.gt(
        BigNumber.from(0),
      );
    }

    const previoustokenBalance = holderBalances[0].balance;
    expect(previoustokenBalance.gt(BigNumber.from(0))).to.be.true;
    // creating the minAmountsOut array
    const minAmount = [];
    for (let i = 0; i < this.underlyingTokens.length; i++) {
      minAmount[i] = 0;
    }
    const tx = await this.PowerEnv.powerIndexPool
      .connect(this.PowerEnv.holders[0])
      .exitPool(previoustokenBalance, minAmount);
    await tx.wait();
    const posttokenBalance = await this.powerIndexPoolERC20.balanceOf(
      await this.PowerEnv.holders[0].getAddress(),
    );
    expect(posttokenBalance.isZero()).to.be.true;
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.PowerEnv.adapter
      .connect(this.signers.default)
      .add(FACTORY_REGISTRIES.POWER);
    await tx.wait();
    const holder2 = await this.PowerEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.powerIndexPoolERC20.balanceOf(holder2Address);
    expect(holder2Balance.gt(BigNumber.from(0))).to.be.true;
    await this.powerIndexPoolERC20.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.PowerEnv.powerIndexPool.address, holder2Balance.div(3), this.PowerEnv.adapter.address);
    expect(
      (await this.liquidityMigration.staked(holder2Address, this.PowerEnv.powerIndexPool.address)).eq(
        holder2Balance.div(3),
      ),
    ).to.be.true;
    const holder2AfterBalance = await this.powerIndexPoolERC20.balanceOf(holder2Address);
    expect(holder2AfterBalance.gt(BigNumber.from(0))).to.be.true;
  });

  it("Should not be able to migrate tokens if the Degen token is not whitelisted in the PowerPool Adapter", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder2 = await this.PowerEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.powerIndexPoolERC20.balanceOf(holder2Address);
    expect(holder2BalanceBefore.gt(BigNumber.from(0))).to.be.true;
    await this.powerIndexPoolERC20
      .connect(holder2)
      .approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.PowerEnv.powerIndexPool.address, holder2BalanceBefore, this.PowerEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.PowerEnv.powerIndexPool.address);
    expect(amount.gt(BigNumber.from(0))).to.be.true;

    const holder2BalanceAfter = await this.powerIndexPoolERC20.balanceOf(holder2Address);
    expect(holder2BalanceAfter.eq(BigNumber.from(0))).to.be.true;
    // Setup migration calls using DEGENAdapter contract
    const migrationCall: Multicall = await this.PowerEnv.adapter.encodeWithdraw(this.PowerEnv.powerIndexPool.address, amount);
    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    // TODO: Dipesh to discuss the follwoing with Peter why do we need the transferCalls array
    for (let i = 0; i < this.underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, this.underlyingTokens[i], this.strategy.address));
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [migrationCall, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    const tx = await this.PowerEnv.adapter
      .connect(this.signers.default)
      .remove(FACTORY_REGISTRIES.POWER);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        ['migrate(address,address,address,bytes)']
        (
          this.PowerEnv.powerIndexPool.address,
          this.PowerEnv.adapter.address,
          this.strategy.address,
          migrationData
        ),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the PowerPool Token as a whitelisted token
    await expect(
      this.PowerEnv.adapter.connect(this.signers.admin).add(FACTORY_REGISTRIES.POWER),
    ).to.be.reverted;
  });

  it("Getting the output token list", async function () {
    // adding the DEGEN Token as a whitelisted token
    const underlyingTokens = await this.PowerEnv.powerIndexPool.getCurrentTokens();
    const outputTokens = await this.PowerEnv.adapter.outputTokens(FACTORY_REGISTRIES.POWER);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    // Setup migration calls using DEGENAdapter contract
    await expect(this.PowerEnv.adapter.encodeWithdraw(this.PowerEnv.powerIndexPool.address, BigNumber.from(10000))).to.be.revertedWith(
      "Whitelistable#onlyWhitelisted: not whitelisted lp",
    );
  });

  it("Should migrate tokens to strategy", async function () {
    // adding the DEGEN Token as a whitelisted token
    const tx = await this.PowerEnv.adapter
      .connect(this.signers.default)
      .add(FACTORY_REGISTRIES.POWER);
    await tx.wait();
    const routerContract = this.enso.routers[0].contract;
    const holder3 = await this.PowerEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.powerIndexPoolERC20.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.powerIndexPoolERC20
      .connect(holder3)
      .approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stake(this.PowerEnv.powerIndexPool.address, holder3BalanceBefore, this.PowerEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder3Address, this.PowerEnv.powerIndexPool.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.powerIndexPoolERC20.balanceOf(holder3Address);
    expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));

    // Setup migration calls using DEGENAdapter contract
    const migrationCall: Multicall = await this.PowerEnv.adapter.encodeWithdraw(this.PowerEnv.powerIndexPool.address, amount);

    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    // TODO: Dipesh to discuss the follwoing with Peter why do we need the transferCalls array
    for (let i = 0; i < this.underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, this.underlyingTokens[i], this.strategy.address));
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [migrationCall, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    // Migrate
    await this.liquidityMigration
      .connect(holder3)
      ['migrate(address,address,address,bytes)']
      (
        this.PowerEnv.powerIndexPool.address,
        this.PowerEnv.adapter.address,
        this.strategy.address,
        migrationData
      );
    const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, this.strategy.address, this.underlyingTokens);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  });

  it("Should fail to buy and stake: token not on exchange", async function () {
    await expect(this.liquidityMigration.connect(this.signers.default).buyAndStake(
      this.powerIndexPoolERC20.address,
      this.PowerEnv.adapter.address,
      UNISWAP_V3_ROUTER,
      0,
      ethers.constants.MaxUint256,
      {value: ethers.constants.WeiPerEther}
    )).to.be.reverted

  })
});
