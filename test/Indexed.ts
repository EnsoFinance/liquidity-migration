import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20, IERC20__factory, IStrategy__factory } from "../typechain";

import { IndexedEnvironmentBuilder } from "../src/indexed";
import { FACTORY_REGISTRIES } from "../src/constants";
import { StrategyBuilder, Position, Multicall, encodeSettleTransfer } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";
import { DIVISOR, THRESHOLD, TIMELOCK, SLIPPAGE } from "../src/constants";

describe("Indexed: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];
    this.underlyingTokens = [];

    this.IndexedEnv = await new IndexedEnvironmentBuilder(this.signers.default).connect();

    console.log(`Indexed Adapter: ${this.IndexedEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin);

    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Indexed, this.IndexedEnv.adapter);
    const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
    if (liquitityMigrationDeployed != undefined) {
      console.log(`Liquidity Migration: ${liquitityMigrationDeployed.address}`);
    } else {
      console.log(`Liquidity Migration is undefined`);
    }

    this.ensoEnv = liquidityMigrationBuilder.enso;
    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;

    // getting the underlying tokens from DPI
    this.underlyingTokens = await this.IndexedEnv.adapter.outputTokens(this.IndexedEnv.degenIndexPool.address);

    // creating the Positions array (that is which token holds how much weigth)
    const positions = [] as Position[];
    const [total, estimates] = await this.ensoEnv.enso.oracle.estimateTotal(
      this.IndexedEnv.degenIndexPool.address,
      this.underlyingTokens,
    );
    // console.log(`Total is: ${total.toString()}`, estimates.forEach((element: BigNumber) => console.log(element.toString())));
    const percentageArray = [];
    for (let i = 0; i < this.underlyingTokens.length; i++) {
      let percentage = new bignumber(estimates[i].toString())
        .multipliedBy(1000)
        .dividedBy(total.toString())
        .toFixed(0);
      const reducer = (a: number, b: number) => a + b;  
      percentageArray.push(Number(percentage.toString()))
      if (
          (i == (this.underlyingTokens.length-1)) && 
          ((percentageArray.reduce(reducer))< 1000)
          ) {
        const diff = 1000 - percentageArray.reduce(reducer);
        percentage = String(Number(percentage)+ diff);
      }
      positions.push({
        token: this.underlyingTokens[i],
        percentage: BigNumber.from(percentage),
      });
    }
    // creating a strategy

    const s = new StrategyBuilder(positions, this.ensoEnv.adapters.uniswap.contract.address);

    const data = ethers.utils.defaultAbiCoder.encode(["address[]", "address[]"], [s.tokens, s.adapters]);

    // createStrategy(address,string,string,address[],uint256[],bool,uint256,uint256,uint256,uint256,address,bytes)'

    const tx = await this.ensoEnv.enso.strategyFactory.createStrategy(
      this.liquidityMigration.address, //Because strategies can't be social without initial deposit, must make LiquidityMigration contract manager
      "DEGEN",
      "DEGEN",
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

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of DEGEN Tokens
    const holderBalances: any[] = [];
    for (let i = 0; i < this.IndexedEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.IndexedEnv.holders[i].getAddress(),
        balance: await this.IndexedEnv.degenIndexPool.balanceOf(await this.IndexedEnv.holders[i].getAddress()),
      };
      expect(await this.IndexedEnv.degenIndexPool.balanceOf(await this.IndexedEnv.holders[i].getAddress())).to.gt(BigNumber.from(0));
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
    const posttokenBalance = await this.IndexedEnv.degenIndexPool.balanceOf(await this.IndexedEnv.holders[0].getAddress());
    expect(posttokenBalance.isZero()).to.be.true;
  });

  it("Token holder should be able to stake LP token", async function () {
    const tx = await this.IndexedEnv.adapter
      .connect(this.signers.default)
      .addAcceptedTokensToWhitelist(FACTORY_REGISTRIES.DEGEN_INDEX);
    await tx.wait();
    const holder2 = await this.IndexedEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.IndexedEnv.degenIndexPool.balanceOf(holder2Address);
    expect(holder2Balance.gt(BigNumber.from(0))).to.be.true;
    await this.IndexedEnv.degenIndexPool.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stakeLpTokens(this.IndexedEnv.degenIndexPool.address, holder2Balance.div(3), AcceptedProtocols.Indexed);
    expect(
      ((await this.liquidityMigration.stakes(holder2Address, this.IndexedEnv.degenIndexPool.address))[0]).eq(holder2Balance.div(3)
      )).to.be.true;
    const holder2AfterBalance = await this.IndexedEnv.degenIndexPool.balanceOf(holder2Address);
    expect((holder2AfterBalance).gt(BigNumber.from(0))).to.be.true;
  });

  it("Should not be able to migrate tokens if the Degen token is not whitelisted in the Indexed Adapter", async function () {
    const routerContract = this.ensoEnv.routers[0].contract;
    const holder2 = await this.IndexedEnv.holders[1];
    const holder2Address = await holder2.getAddress();
    // staking the tokens in the liquidity migration contract
    const holder2BalanceBefore = await this.IndexedEnv.degenIndexPool.balanceOf(holder2Address);
    expect((holder2BalanceBefore).gt(BigNumber.from(0))).to.be.true;
    await this.IndexedEnv.degenIndexPool.connect(holder2).approve(this.liquidityMigration.address, holder2BalanceBefore);
    await this.liquidityMigration
      .connect(holder2)
      .stakeLpTokens(this.IndexedEnv.degenIndexPool.address, holder2BalanceBefore, AcceptedProtocols.Indexed);
    const amount = (await this.liquidityMigration.stakes(holder2Address, this.IndexedEnv.degenIndexPool.address))[0];
    expect((amount).gt(BigNumber.from(0))).to.be.true;

    const holder2BalanceAfter = await this.IndexedEnv.degenIndexPool.balanceOf(holder2Address);
    expect(holder2BalanceAfter.eq(BigNumber.from(0))).to.be.true;
    // Setup migration calls using DPIAdapter contract
    const adapterData = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256"],
      [this.IndexedEnv.degenIndexPool.address, amount],
    );
    const migrationCalls: Multicall[] = await this.IndexedEnv.adapter.encodeExecute(adapterData);
    // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    // TODO: Dipesh to discuss the follwoing with Peter why do we need the transferCalls array
    for (let i = 0; i < this.underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, this.underlyingTokens[i], this.strategy.address));
    }
    // Encode multicalls for GenericRouter
    const calls: Multicall[] = [...migrationCalls, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    const tx = await this.IndexedEnv.adapter
      .connect(this.signers.default)
      .removeTokensFromWhitelist(FACTORY_REGISTRIES.DEGEN_INDEX);
    await tx.wait();
    // Migrate
    await expect(
      this.liquidityMigration
        .connect(holder2)
        .migrate(
          this.strategy.address,
          this.IndexedEnv.degenIndexPool.address,
          AcceptedProtocols.Indexed,
          migrationData,
          0,
        ),
    ).to.be.reverted;
  });

  it("Adding to whitelist from non-manager account should fail", async function () {
    // adding the Indexed Token as a whitelisted token
    await expect(this.IndexedEnv.adapter.connect(this.signers.admin).addAcceptedTokensToWhitelist(FACTORY_REGISTRIES.DEGEN_INDEX))
      .to.be.reverted;
  });

  it("Getting the output token list", async function () {
    // adding the DPI Token as a whitelisted token
    const underlyingTokens = await this.IndexedEnv.degenIndexPool.getCurrentTokens();
    const outputTokens = await this.IndexedEnv.adapter.outputTokens(FACTORY_REGISTRIES.DEGEN_INDEX);
    expect(underlyingTokens).to.be.eql(outputTokens);
  });

  it("Migration using a non-whitelisted token should fail", async function () {
    const routerContract = this.ensoEnv.routers[0].contract;
    const holder3 = await this.IndexedEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // Setup migration calls using DPIAdapter contract
    const adapterData = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "address"],
      [holder3Address, BigNumber.from(100), routerContract.address],
    );
    await expect(this.IndexedEnv.adapter.encodeExecute(adapterData)).to.be.revertedWith("IndexedAdapter: invalid Index Pool Address");
  });

  // it("Should migrate tokens to strategy", async function () {
  //   // adding the DPI Token as a whitelisted token
  //   const tx = await this.IndexedEnv.adapter
  //     .connect(this.signers.default)
  //     .addAcceptedTokensToWhitelist(FACTORY_REGISTRIES.DEGEN_INDEX);
  //   await tx.wait();
  //   const routerContract = this.ensoEnv.routers[0].contract;
  //   const holder3 = await this.IndexedEnv.holders[2];
  //   const holder3Address = await holder3.getAddress();

  //   // staking the tokens in the liquidity migration contract
  //   const holder3BalanceBefore = await this.IndexedEnv.degenIndexPool.balanceOf(holder3Address);
  //   expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

  //   await this.IndexedEnv.degenIndexPool.connect(holder3).approve(this.liquidityMigration.address, holder3BalanceBefore);
  //   await this.liquidityMigration
  //     .connect(holder3)
  //     .stakeLpTokens(this.IndexedEnv.degenIndexPool.address, holder3BalanceBefore, AcceptedProtocols.Indexed);
  //   const amount = (await this.liquidityMigration.stakes(holder3Address, this.IndexedEnv.degenIndexPool.address))[0];
  //   expect(amount).to.be.gt(BigNumber.from(0));
  //   const holder3BalanceAfter = await this.IndexedEnv.degenIndexPool.balanceOf(holder3Address);
  //   expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));

  //   // Setup migration calls using DPIAdapter contract
  //   const adapterData = ethers.utils.defaultAbiCoder.encode(
  //     ["address", "uint256", "address"],
  //     [this.IndexedEnv.degenIndexPool.address, amount, routerContract.address],
  //   );
  //   const migrationCalls: Multicall[] = await this.IndexedEnv.adapter.encodeExecute(adapterData);

  //   // // Setup transfer of tokens from router to strategy
  //   const transferCalls = [] as Multicall[];
  //   const underlyingTokens = await this.IndexedEnv.degenIndexPool.getCurrentTokens();
  //   // TODO: Dipesh to discuss the follwoing with Peter why do we need the transferCalls array
  //   for (let i = 0; i < underlyingTokens.length; i++) {
  //     transferCalls.push(encodeSettleTransfer(routerContract, underlyingTokens[i], this.strategy.address));
  //   }
  //   // // Encode multicalls for GenericRouter
  //   const calls: Multicall[] = [...migrationCalls, ...transferCalls];
  //   const migrationData = await routerContract.encodeCalls(calls);
  //   // // Migrate
  //   await this.liquidityMigration
  //     .connect(holder3)
  //     .migrate(this.strategy.address, this.IndexedEnv.degenIndexPool.address, AcceptedProtocols.Indexed, migrationData, 0);
  //   const [total] = await this.ensoEnv.enso.oracle.estimateTotal(this.strategy.address, underlyingTokens);
  //   expect(total).to.gt(0);
  //   expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  // });
});
