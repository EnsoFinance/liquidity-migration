import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory, IStrategy__factory } from "../typechain";

import { IndexedEnvironmentBuilder } from "../src/indexed";
import { FACTORY_REGISTRIES } from "../src/constants";
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";
import { WETH, DIVISOR, STRATEGY_STATE } from "../src/constants";

describe("Indexed: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];
    this.signers.otherAccount = signers[5];
    this.underlyingTokens = [];

    this.ensoEnv = await new EnsoBuilder(this.signers.admin).mainnet().build();

    this.IndexedEnv = await new IndexedEnvironmentBuilder(this.signers.default).connect();
    this.degenIndexPoolERC20 = IERC20__factory.connect(this.IndexedEnv.degenIndexPool.address, this.signers.default);

    console.log(`Indexed Adapter: ${this.IndexedEnv.adapter.address}`);

    const atx = await this.IndexedEnv.adapter
      .connect(this.signers.default)
      .add(FACTORY_REGISTRIES.DEGEN_INDEX);
    await atx.wait();

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.ensoEnv);
    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Indexed, this.IndexedEnv.adapter);
    const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
    if (liquitityMigrationDeployed != undefined) {
      console.log(`Liquidity Migration: ${liquitityMigrationDeployed.address}`);
    } else {
      console.log(`Liquidity Migration is undefined`);
    }

    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;
    this.liquidityMigrationContract = liquitityMigrationDeployed;

    // getting the underlying tokens from DEGEN
    this.underlyingTokens = await this.IndexedEnv.adapter.outputTokens(this.IndexedEnv.degenIndexPool.address);

    // creating the Positions array (that is which token holds how much weigth)
    const positions = [] as Position[];
    const [total, estimates] = await this.ensoEnv.enso.uniswapOracle.estimateTotal(
      this.IndexedEnv.degenIndexPool.address,
      this.underlyingTokens,
    );
    // console.log(`Total is: ${total.toString()}`, estimates.forEach((element: BigNumber) => console.log(element.toString())));
    const percentageArray = [];
    for (let i = 0; i < this.underlyingTokens.length; i++) {
      let percentage = new bignumber(estimates[i].toString()).multipliedBy(1000).dividedBy(total.toString()).toFixed(0);
      const reducer = (a: number, b: number) => a + b;
      percentageArray.push(Number(percentage.toString()));
      if (i == this.underlyingTokens.length - 1 && percentageArray.reduce(reducer) < 1000) {
        const diff = 1000 - percentageArray.reduce(reducer);
        percentage = String(Number(percentage) + diff);
      }
      positions.push({
        token: this.underlyingTokens[i],
        percentage: BigNumber.from(percentage),
      });
    }
    if (positions.findIndex(pos => pos.token.toLowerCase() == WETH.toLowerCase()) == -1) {
      positions.push({
        token: WETH,
        percentage: BigNumber.from(0),
      });
    }

    // creating a strategy
    this.strategyItems = prepareStrategy(positions, this.ensoEnv.adapters.uniswap.contract.address);


    this.data = ethers.utils.defaultAbiCoder.encode(
      ["address", "string", "string", "tuple(address item, uint16 percentage, uint256 category, bytes cache, address[] adapters, address[] path)[]", "tuple(uint32 timelock, uint16 rebalanceThreshold, uint16 slippage, uint16 performanceFee, bool social)", "address", "bytes"],
      [this.signers.default.address,
        "DEGEN",
        "DEGEN",
        this.strategyItems,
        STRATEGY_STATE,
        ethers.constants.AddressZero,
        '0x']
      );

    this.strategyAddress;
    this.strategy;
  });

  it("Should be able to create strategy from the liquidity migration contract", async function () {
    const tx = await this.liquidityMigrationContract.createStrategy(
      this.IndexedEnv.degenIndexPool.address,
      this.IndexedEnv.adapter.address,
      this.data
    );
    const receipt = await tx.wait();
    await expect(tx).to.emit(this.liquidityMigrationContract, 'Created');
    this.strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
    this.strategy = IStrategy__factory.connect(this.strategyAddress, this.signers.default);
  });

  it("Adding Already existing adapter should throw error", async function () {
    await expect(this.liquidityMigrationContract.addAdapter(
      this.IndexedEnv.adapter.address,
    )).to.be.revertedWith("LiquidityMigration#updateAdapter: already exists");
  });

  it("Adding and removing adapter only by Owner should be successfful", async function () {
    await expect(this.liquidityMigrationContract.connect(this.signers.otherAccount).addAdapter(
      this.IndexedEnv.adapter.address,
    )).to.be.revertedWith("Ownable: caller is not the owner");
    await this.liquidityMigrationContract.addAdapter(this.underlyingTokens[0]);
    expect(await this.liquidityMigrationContract.adapters(this.underlyingTokens[0])).to.be.true;
    await this.liquidityMigrationContract.removeAdapter(this.underlyingTokens[0]);
    expect(await this.liquidityMigrationContract.adapters(this.underlyingTokens[0])).to.be.false;
  });

  it("Adding and removing generic router only by Owner should be successfful", async function () {
    await expect(this.liquidityMigrationContract.updateGeneric(
      this.ensoEnv.routers[0].contract.address,
    )).to.be.revertedWith("LiquidityMigration#updateGeneric: already exists");
    await expect(this.liquidityMigrationContract.connect(this.signers.otherAccount).updateGeneric(
      this.ensoEnv.routers[0].contract.address,
    )).to.be.revertedWith("Ownable: caller is not the owner");
    await this.liquidityMigrationContract.updateGeneric(this.underlyingTokens[0]);
    expect(await this.liquidityMigrationContract.generic()).to.be.equal(this.underlyingTokens[0]);
    await this.liquidityMigrationContract.updateGeneric(this.ensoEnv.routers[0].contract.address);
    expect(await this.liquidityMigrationContract.generic()).to.be.equal(this.ensoEnv.routers[0].contract.address);
  });

  it("Adding and removing controller only by Owner should be successfful", async function () {
    await expect(this.liquidityMigrationContract.updateController(
      this.ensoEnv.enso.controller.address,
    )).to.be.revertedWith("LiquidityMigration#updateController: already exists");
    await expect(this.liquidityMigrationContract.connect(this.signers.otherAccount).updateController(
      this.ensoEnv.enso.controller.address,
    )).to.be.revertedWith("Ownable: caller is not the owner");
    await this.liquidityMigrationContract.updateController(this.underlyingTokens[0]);
    expect(await this.liquidityMigrationContract.controller()).to.be.equal(this.underlyingTokens[0]);
    await this.liquidityMigrationContract.updateController(this.ensoEnv.enso.controller.address);
    expect(await this.liquidityMigrationContract.controller()).to.be.equal(this.ensoEnv.enso.controller.address);
  });

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of DEGEN Tokens
    const holderBalances: any[] = [];

    for (let i = 0; i < this.IndexedEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.IndexedEnv.holders[i].getAddress(),
        balance: await this.degenIndexPoolERC20.balanceOf(await this.IndexedEnv.holders[i].getAddress()),
      };
      expect(await this.degenIndexPoolERC20.balanceOf(await this.IndexedEnv.holders[i].getAddress())).to.gt(
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
    const tx = await this.IndexedEnv.degenIndexPool
      .connect(this.IndexedEnv.holders[0])
      .exitPool(previoustokenBalance, minAmount);
    await tx.wait();
    const posttokenBalance = await this.degenIndexPoolERC20.balanceOf(
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

    const holder2Balance = await this.degenIndexPoolERC20.balanceOf(holder2Address);
    expect(holder2Balance.gt(BigNumber.from(0))).to.be.true;
    await this.degenIndexPoolERC20.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.IndexedEnv.degenIndexPool.address, holder2Balance.div(3), this.IndexedEnv.adapter.address);
    const stakedBool = await this.liquidityMigration
    .connect(holder2)
    .hasStaked(holder2Address, this.IndexedEnv.degenIndexPool.address);
    expect(stakedBool).to.be.true;
    expect(
      (await this.liquidityMigration.staked(holder2Address, this.IndexedEnv.degenIndexPool.address)).eq(
        holder2Balance.div(3),
      ),
    ).to.be.true;
    const holder2AfterBalance = await this.degenIndexPoolERC20.balanceOf(holder2Address);
    expect(holder2AfterBalance.gt(BigNumber.from(0))).to.be.true;
  });

  it("Should not be able to migrate tokens if the Degen token is not whitelisted in the Indexed Adapter", async function () {
    const routerContract = this.ensoEnv.routers[0].contract;
    const holder2 = await this.IndexedEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.degenIndexPoolERC20.balanceOf(holder2Address);
    expect(holder2BalanceBefore.gt(BigNumber.from(0))).to.be.true;
    await this.degenIndexPoolERC20
      .connect(holder2)
      .approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stake(this.IndexedEnv.degenIndexPool.address, holder2BalanceBefore, this.IndexedEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder2Address, this.IndexedEnv.degenIndexPool.address);
    expect(amount.gt(BigNumber.from(0))).to.be.true;

    const holder2BalanceAfter = await this.degenIndexPoolERC20.balanceOf(holder2Address);
    expect(holder2BalanceAfter.eq(BigNumber.from(0))).to.be.true;
    // Setup migration calls using DEGENAdapter contract
    const migrationCall: Multicall = await this.IndexedEnv.adapter.encodeExecute(this.IndexedEnv.degenIndexPool.address, amount);
    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    for (let i = 0; i < this.underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, this.underlyingTokens[i], this.strategy.address));
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [migrationCall, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    const tx = await this.IndexedEnv.adapter
      .connect(this.signers.default)
      .remove(FACTORY_REGISTRIES.DEGEN_INDEX);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        .migrate(
          this.IndexedEnv.degenIndexPool.address,
          this.IndexedEnv.adapter.address,
          this.strategy.address,
          migrationData
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
    const underlyingTokens = await this.IndexedEnv.degenIndexPool.getCurrentTokens();
    const outputTokens = await this.IndexedEnv.adapter.outputTokens(FACTORY_REGISTRIES.DEGEN_INDEX);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    // Setup migration calls using DEGENAdapter contract
    await expect(this.IndexedEnv.adapter.encodeExecute(this.IndexedEnv.degenIndexPool.address, BigNumber.from(10000))).to.be.revertedWith(
      "Whitelistable#onlyWhitelisted: not whitelisted lp",
    );
  });

  it("Should migrate tokens to strategy", async function () {
    // adding the DEGEN Token as a whitelisted token
    const tx = await this.IndexedEnv.adapter
      .connect(this.signers.default)
      .add(FACTORY_REGISTRIES.DEGEN_INDEX);
    await tx.wait();
    const routerContract = this.ensoEnv.routers[0].contract;
    const holder3 = await this.IndexedEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.degenIndexPoolERC20.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.degenIndexPoolERC20
      .connect(holder3)
      .approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stake(this.IndexedEnv.degenIndexPool.address, holder3BalanceBefore, this.IndexedEnv.adapter.address);
    const amount = await this.liquidityMigration.staked(holder3Address, this.IndexedEnv.degenIndexPool.address);
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.degenIndexPoolERC20.balanceOf(holder3Address);
    expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));

    // Setup migration calls using DEGENAdapter contract
    const migrationCall: Multicall = await this.IndexedEnv.adapter.encodeExecute(this.IndexedEnv.degenIndexPool.address, amount);

    // // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    const underlyingTokens = await this.IndexedEnv.degenIndexPool.getCurrentTokens();
    for (let i = 0; i < underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, underlyingTokens[i], this.strategy.address));
    }
    // // Encode multicalls for GenericRouter
    const calls: Multicall[] = [migrationCall, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    // // Migrate
    await this.liquidityMigration
      .connect(holder3)
      .migrate(
        this.IndexedEnv.degenIndexPool.address,
        this.IndexedEnv.adapter.address,
        this.strategy.address,
        migrationData
      );
    const [total] = await this.ensoEnv.enso.uniswapOracle.estimateTotal(this.strategy.address, underlyingTokens);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  });

  // it("Updating functions of Liquidity Migration", async function () {
  //   const tx = await this.liquidityMigrationContract.updateController(
  //     this.IndexedEnv.degenIndexPool.address,
  //     this.IndexedEnv.adapter.address,
  //     this.data
  //   );
  //   const receipt = await tx.wait();
  //   await expect(tx).to.emit(this.liquidityMigrationContract, 'Created');
  //   this.strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
  //   this.strategy = IStrategy__factory.connect(this.strategyAddress, this.signers.default);
  // });



});
