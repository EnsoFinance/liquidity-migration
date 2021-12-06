import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory, IStrategy__factory } from "../typechain";

import { IndexedEnvironmentBuilder } from "../src/indexed";
import { DEPOSIT_SLIPPAGE, FACTORY_REGISTRIES, INITIAL_STATE, UNISWAP_V2_ROUTER } from "../src/constants";
import { setupStrategyItems, estimateTokens, encodeStrategyData } from "../src/utils"
import { EnsoBuilder} from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";

describe("Indexed: Unit tests", function () {
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

    console.log(`Indexed Adapter: ${this.IndexedEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.enso);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Indexed, this.IndexedEnv.adapter);
    const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
    if (liquitityMigrationDeployed != undefined) {
      console.log(`Liquidity Migration: ${liquitityMigrationDeployed.address}`);
    } else {
      console.log(`Liquidity Migration is undefined`);
    }

    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;

    // getting the underlying tokens from DEGEN
    this.underlyingTokens = await this.IndexedEnv.adapter.outputTokens(this.IndexedEnv.pool.address);
  });

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of DEGEN Tokens
    const holderBalances: any[] = [];

    for (let i = 0; i < this.IndexedEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.IndexedEnv.holders[i].getAddress(),
        balance: await this.indexedErc20.balanceOf(await this.IndexedEnv.holders[i].getAddress()),
      };
      expect(await this.indexedErc20.balanceOf(await this.IndexedEnv.holders[i].getAddress())).to.gt(
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
    const tx = await this.IndexedEnv.pool
      .connect(this.IndexedEnv.holders[0])
      .exitPool(previoustokenBalance, minAmount);
    await tx.wait();
    const posttokenBalance = await this.indexedErc20.balanceOf(
      await this.IndexedEnv.holders[0].getAddress(),
    );
    expect(posttokenBalance.isZero()).to.be.true;
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.IndexedEnv.adapter
      .connect(this.signers.default)
      .add(FACTORY_REGISTRIES.DEGEN_INDEX);
    await tx.wait();
    const holder2 = await this.IndexedEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.indexedErc20.balanceOf(holder2Address);
    expect(holder2Balance.gt(BigNumber.from(0))).to.be.true;
    await this.indexedErc20.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.IndexedEnv.pool.address, holder2Balance.div(3), this.IndexedEnv.adapter.address);
    expect(
      (await this.liquidityMigration.staked(holder2Address, this.IndexedEnv.pool.address)).eq(
        holder2Balance.div(3),
      ),
    ).to.be.true;
    const holder2AfterBalance = await this.indexedErc20.balanceOf(holder2Address);
    expect(holder2AfterBalance.gt(BigNumber.from(0))).to.be.true;
  });

  it("Should not be able to migrate tokens if the Degen token is not whitelisted in the Indexed Adapter", async function () {
    const routerContract = this.enso.routers[0].contract;
    const holder2 = await this.IndexedEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.indexedErc20.balanceOf(holder2Address);
    expect(holder2BalanceBefore.gt(BigNumber.from(0))).to.be.true;
    await this.indexedErc20
      .connect(holder2)
      .approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.IndexedEnv.pool.address, holder2BalanceBefore, this.IndexedEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.IndexedEnv.pool.address);
    expect(amount.gt(BigNumber.from(0))).to.be.true;

    const holder2BalanceAfter = await this.indexedErc20.balanceOf(holder2Address);
    expect(holder2BalanceAfter.eq(BigNumber.from(0))).to.be.true;
    const tx = await this.IndexedEnv.adapter
      .connect(this.signers.default)
      .remove(FACTORY_REGISTRIES.DEGEN_INDEX);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        ['migrate(address,address,address,uint256)'](
          this.IndexedEnv.pool.address,
          this.IndexedEnv.adapter.address,
          ethers.constants.AddressZero,
          DEPOSIT_SLIPPAGE
        ),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the Indexed Token as a whitelisted token
    await expect(
      this.IndexedEnv.adapter.connect(this.signers.admin).add(FACTORY_REGISTRIES.DEGEN_INDEX),
    ).to.be.reverted;
  });

  it("Getting the output token list", async function () {
    // adding the DEGEN Token as a whitelisted token
    const underlyingTokens = await this.IndexedEnv.pool.getCurrentTokens();
    const outputTokens = await this.IndexedEnv.adapter.outputTokens(FACTORY_REGISTRIES.DEGEN_INDEX);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    // Setup migration calls using DEGENAdapter contract
    await expect(this.IndexedEnv.adapter.encodeWithdraw(this.IndexedEnv.pool.address, BigNumber.from(10000))).to.be.revertedWith(
      "Whitelistable#onlyWhitelisted: not whitelisted lp",
    );
  });

  it("Create strategy", async function () {
      // adding the DEGEN Token as a whitelisted token
      let tx = await this.IndexedEnv.adapter
        .connect(this.signers.default)
        .add(FACTORY_REGISTRIES.DEGEN_INDEX);
      await tx.wait();

      // deploy strategy
      const strategyData = encodeStrategyData(
        this.signers.default.address,
        "DEGEN",
        "DEGEN",
        await setupStrategyItems(this.enso.platform.oracles.ensoOracle, this.enso.adapters.uniswap.contract.address, this.IndexedEnv.pool.address, this.underlyingTokens),
        INITIAL_STATE,
        ethers.constants.AddressZero,
        '0x'
      )
      tx = await this.liquidityMigration.createStrategy(
        this.indexedErc20.address,
        this.IndexedEnv.adapter.address,
        strategyData
      );
      const receipt = await tx.wait();
      const strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
      console.log("Strategy address: ", strategyAddress);
      this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  })

  it("Should migrate tokens to strategy", async function () {
    const holder3 = await this.IndexedEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.indexedErc20.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.indexedErc20
      .connect(holder3)
      .approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stake(this.IndexedEnv.pool.address, holder3BalanceBefore, this.IndexedEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder3Address, this.IndexedEnv.pool.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.indexedErc20.balanceOf(holder3Address);
    expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));

    const tx = await this.liquidityMigration
      .connect(holder3)['migrate(address,address,address,uint256)'](
        this.IndexedEnv.pool.address,
        this.IndexedEnv.adapter.address,
        this.strategy.address,
        DEPOSIT_SLIPPAGE
      );
    const receipt = await tx.wait()
    console.log('Migration Gas Used: ', receipt.gasUsed.toString())
    const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, this.strategy.address, this.underlyingTokens);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  });

  it("Should buy and stake", async function () {
    const defaultAddress = await this.signers.default.getAddress();

    expect(await this.indexedErc20.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.strategy.balanceOf(defaultAddress)).to.be.eq(BigNumber.from(0));
    expect(await this.liquidityMigration.staked(defaultAddress, this.indexedErc20.address)).to.be.eq(BigNumber.from(0));

    const ethAmount = ethers.constants.WeiPerEther
    const expectedAmount = await this.IndexedEnv.adapter.callStatic.getAmountOut(this.indexedErc20.address, UNISWAP_V2_ROUTER, ethAmount)
    console.log("Expected: ", expectedAmount.toString())

    await this.liquidityMigration.connect(this.signers.default).buyAndStake(
      this.indexedErc20.address,
      this.IndexedEnv.adapter.address,
      UNISWAP_V2_ROUTER,
      expectedAmount.mul(995).div(1000), //0.5% slippage
      ethers.constants.MaxUint256,
      {value: ethAmount}
    )

    const staked = await this.liquidityMigration.staked(defaultAddress, this.indexedErc20.address)
    console.log("Staked: ", staked.toString())
    expect(staked).to.be.gt(BigNumber.from(0));
  })
});
