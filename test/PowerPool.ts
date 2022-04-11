import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory, IStrategy__factory } from "../typechain";
import { PowerpoolEnvironmentBuilder } from "../src/powerpool";
import {
  FACTORY_REGISTRIES,
  WETH,
  DIVISOR,
  INITIAL_STATE,
  UNISWAP_V3_ROUTER,
  DEPOSIT_SLIPPAGE,
} from "../src/constants";
import { setupStrategyItems, estimateTokens } from "../src/utils";
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer } from "@ensofinance/v1-core";
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

    this.erc20 = IERC20__factory.connect(this.PowerEnv.pool.address, this.signers.default);

    console.log(`Powerpool Adapter: ${this.PowerEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.enso);

    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Powerpool, this.PowerEnv.adapter);
    await liquidityMigrationBuilder.deploy();
    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;

    // getting the underlying tokens from DEGEN
    this.underlyingTokens = await this.PowerEnv.adapter.outputTokens(this.PowerEnv.pool.address);

    const tx = await this.enso.platform.strategyFactory.createStrategy(
      this.signers.default.address,
      "power",
      "power",
      await setupStrategyItems(
        this.enso.platform.oracles.ensoOracle,
        this.enso.adapters.uniswap.contract.address,
        this.PowerEnv.pool.address,
        this.underlyingTokens,
      ),
      INITIAL_STATE,
      ethers.constants.AddressZero,
      "0x",
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
        balance: await this.erc20.balanceOf(await this.PowerEnv.holders[i].getAddress()),
      };
      expect(await this.erc20.balanceOf(await this.PowerEnv.holders[i].getAddress())).to.gt(BigNumber.from(0));
    }

    const previoustokenBalance = holderBalances[0].balance;
    expect(previoustokenBalance.gt(BigNumber.from(0))).to.be.true;
    // creating the minAmountsOut array
    const minAmount = [];
    for (let i = 0; i < this.underlyingTokens.length; i++) {
      minAmount[i] = 0;
    }
    const tx = await this.PowerEnv.pool.connect(this.PowerEnv.holders[0]).exitPool(previoustokenBalance, minAmount);
    await tx.wait();
    const posttokenBalance = await this.erc20.balanceOf(await this.PowerEnv.holders[0].getAddress());
    expect(posttokenBalance.isZero()).to.be.true;
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.PowerEnv.adapter.connect(this.signers.default).add(FACTORY_REGISTRIES.POWER);
    await tx.wait();
    const holder2 = await this.PowerEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.erc20.balanceOf(holder2Address);
    expect(holder2Balance.gt(BigNumber.from(0))).to.be.true;
    await this.erc20.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.PowerEnv.pool.address, holder2Balance.div(3), this.PowerEnv.adapter.address);
    expect((await this.liquidityMigration.staked(holder2Address, this.PowerEnv.pool.address)).eq(holder2Balance.div(3)))
      .to.be.true;
    const holder2AfterBalance = await this.erc20.balanceOf(holder2Address);
    expect(holder2AfterBalance.gt(BigNumber.from(0))).to.be.true;
  });

  it("Should not be able to migrate tokens if the Degen token is not whitelisted in the PowerPool Adapter", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder2 = await this.PowerEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.erc20.balanceOf(holder2Address);
    expect(holder2BalanceBefore.gt(BigNumber.from(0))).to.be.true;
    await this.erc20.connect(holder2).approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.PowerEnv.pool.address, holder2BalanceBefore, this.PowerEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.PowerEnv.pool.address);
    expect(amount.gt(BigNumber.from(0))).to.be.true;

    const holder2BalanceAfter = await this.erc20.balanceOf(holder2Address);
    expect(holder2BalanceAfter.eq(BigNumber.from(0))).to.be.true;

    const tx = await this.PowerEnv.adapter.connect(this.signers.default).remove(FACTORY_REGISTRIES.POWER);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        ["migrate(address,address,address,uint256)"](
          this.PowerEnv.pool.address,
          this.PowerEnv.adapter.address,
          this.strategy.address,
          DEPOSIT_SLIPPAGE,
        ),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the PowerPool Token as a whitelisted token
    await expect(this.PowerEnv.adapter.connect(this.signers.admin).add(FACTORY_REGISTRIES.POWER)).to.be.reverted;
  });

  it("Getting the output token list", async function () {
    // adding the DEGEN Token as a whitelisted token
    const underlyingTokens = await this.PowerEnv.pool.getCurrentTokens();
    const outputTokens = await this.PowerEnv.adapter.outputTokens(FACTORY_REGISTRIES.POWER);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    // Setup migration calls using DEGENAdapter contract
    await expect(
      this.PowerEnv.adapter.encodeWithdraw(this.PowerEnv.pool.address, BigNumber.from(10000)),
    ).to.be.revertedWith("Whitelistable#onlyWhitelisted: not whitelisted lp");
  });

  it("Should migrate tokens to strategy", async function () {
    // adding the DEGEN Token as a whitelisted token
    const tx = await this.PowerEnv.adapter.connect(this.signers.default).add(FACTORY_REGISTRIES.POWER);
    await tx.wait();
    const routerContract = this.enso.routers[0].contract;
    const holder3 = await this.PowerEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.erc20.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.erc20.connect(holder3).approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stake(this.PowerEnv.pool.address, holder3BalanceBefore, this.PowerEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder3Address, this.PowerEnv.pool.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.erc20.balanceOf(holder3Address);
    expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));

    // Migrate
    await this.liquidityMigration
      .connect(holder3)
      ["migrate(address,address,address,uint256)"](
        this.PowerEnv.pool.address,
        this.PowerEnv.adapter.address,
        this.strategy.address,
        DEPOSIT_SLIPPAGE,
      );
    const [total] = await estimateTokens(
      this.enso.platform.oracles.ensoOracle,
      this.strategy.address,
      this.underlyingTokens,
    );
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  });

  it("Should fail to buy and stake: token not on exchange", async function () {
    await expect(
      this.liquidityMigration
        .connect(this.signers.default)
        .buyAndStake(
          this.erc20.address,
          this.PowerEnv.adapter.address,
          UNISWAP_V3_ROUTER,
          0,
          ethers.constants.MaxUint256,
          { value: ethers.constants.WeiPerEther },
        ),
    ).to.be.reverted;
  });
});
