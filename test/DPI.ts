import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { BigNumber, Contract, Event } from "ethers";
import { Signers, MainnetSigner } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { ClashingImplementation, IERC20, IERC20__factory, IStrategy__factory } from "../typechain";

import { DPIEnvironmentBuilder } from "../src/dpi";
import { StrategyBuilder, Position, Multicall, encodeSettleTransfer } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";
import { DIVISOR, THRESHOLD, TIMELOCK, SLIPPAGE } from "../src/constants";

describe("DPI: Unit tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];

    this.DPIEnv = await new DPIEnvironmentBuilder(this.signers.default).connect();

    console.log(`DPI Adapter: ${this.DPIEnv.adapter.address}`);

    const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin);

    liquidityMigrationBuilder.addAdapter(AcceptedProtocols.DefiPulseIndex, this.DPIEnv.adapter);
    const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
    if (liquitityMigrationDeployed != undefined) {
      console.log(`Liquidity Migration: ${liquitityMigrationDeployed.address}`);
    } else {
      console.log(`Liquidity Migration is undefined`);
    }

    this.ensoEnv = liquidityMigrationBuilder.enso;
    this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;

    // getting the underlying tokens from DPI
    const underlyingTokens = await this.DPIEnv.DPIToken.getComponents();

    // creating the Positions array (that is which token holds how much weigth)
    const positions = [] as Position[];
    const [total, estimates] = await this.ensoEnv.enso.oracle.estimateTotal(
      this.DPIEnv.DPIToken.address,
      underlyingTokens,
    );
    for (let i = 0; i < underlyingTokens.length; i++) {
      const percentage = new bignumber(estimates[i].toString())
        .multipliedBy(DIVISOR)
        .dividedBy(total.toString())
        .toFixed(0);
      positions.push({
        token: underlyingTokens[i],
        percentage: BigNumber.from(percentage),
      });
    }

    // creating a strategy

    const s = new StrategyBuilder(positions, this.ensoEnv.adapters.uniswap.contract.address);

    const data = ethers.utils.defaultAbiCoder.encode(["address[]", "address[]"], [s.tokens, s.adapters]);

    // createStrategy(address,string,string,address[],uint256[],bool,uint256,uint256,uint256,uint256,address,bytes)'

    const tx = await this.ensoEnv.enso.strategyFactory.createStrategy(
      this.liquidityMigration.address, //Because strategies can't be social without initial deposit, must make LiquidityMigration contract manager
      "DPI",
      "DPI",
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
    // getting holders of DPI Tokens

    const holderBalances: any[] = [];
    for (let i = 0; i < this.DPIEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.DPIEnv.holders[i].getAddress(),
        balance: await this.DPIEnv.DPIToken.balanceOf(await this.DPIEnv.holders[i].getAddress()),
      };
      expect(await this.DPIEnv.DPIToken.balanceOf(await this.DPIEnv.holders[i].getAddress())).to.gt(BigNumber.from(0));
    }

    // getting the underlying tokens
    const underlyingTokens = await this.DPIEnv.DPIToken.getComponents();
    // const gb = async () => {
    //   console.log("This should come in the begining");
    //   const underlyingTokens = await this.DPIEnv.DPIToken.getComponents();
    //   console.log("First step: Got the underlying tokens array");
    //   underlyingTokens.forEach(async (element: string) => {
    //     console.log("Second Step: Looping through each item of the underlying tokens array");
    //     const tokenContract = IERC20__factory.connect(element, this.signers.default) as IERC20;
    //     console.log("Created the Contract for each one of the underlying tokens", tokenContract.address);
    //     const totalSupply = await tokenContract.totalSupply();
    //     console.log("The total supply of this contract is", totalSupply.toString());
    //     console.log("calling the holders array so that we can loop through each of the items");
    //     const pq = async () => {
    //       console.log("calling the pq function");
    //       holderBalances.forEach(async (e: any) => {
    //         console.log("holder is:", e.holder);
    //         // const balance = await tokenContract.balanceOf(e.holder);
    //         // console.log(balance.toString());
    //       });
    //     }
    //     await pq();
    //   });
    // }
    // await gb();
    // console.log("This should come in the end");

    // interface underlyingTokenBalances {
    //   [key: string]: BigNumber
    // };
    // const ub: underlyingTokenBalances = {};

    // for (let index = 0; index < underlyingTokens.length; index++) {
    //       const tokenContract = IERC20__factory.connect(underlyingTokens[index], this.signers.default) as IERC20;
    //       const contractAddress = tokenContract.address;
    //       holderBalances.forEach(async (e)=>
    //         {
    //           const balance = await tokenContract.balanceOf(e.holder);
    //           // adding key value pair to the empty object created
    //           ub[contractAddress] =  balance;
    //         })
    // }

    // console.log(ub);

    // redeeming the token
    const setBasicIssuanceModule = this.DPIEnv.setBasicIssuanceModule;
    const addressWhoIsRedeeming = await this.DPIEnv.holders[0].getAddress();
    const address_toWhom = addressWhoIsRedeeming;
    const tokenBalance = holderBalances[0].balance;
    const tokenContract = IERC20__factory.connect(underlyingTokens[0], this.DPIEnv.holders[0]) as IERC20;
    const previousUnderlyingTokenBalance = await tokenContract.balanceOf(addressWhoIsRedeeming);
    const tx = await setBasicIssuanceModule
      .connect(this.DPIEnv.holders[0])
      .redeem(this.DPIEnv.DPIToken.address, tokenBalance, address_toWhom);
    await tx.wait();
    const updatedDPIBalance = await this.DPIEnv.DPIToken.balanceOf(address_toWhom);
    const updatedUnderlyingTokenBalance = await tokenContract.balanceOf(addressWhoIsRedeeming);
    expect(updatedDPIBalance).to.equal(BigNumber.from(0));
    expect(updatedUnderlyingTokenBalance.gt(previousUnderlyingTokenBalance)).to.be.true;
  });

  it("Token holder should be able to stake LP token", async function () {
    const holder2 = await this.DPIEnv.holders[1];
    const holder2Address = await holder2.getAddress();

    const holder2Balance = await this.DPIEnv.DPIToken.balanceOf(holder2Address);
    expect(holder2Balance).to.be.gt(BigNumber.from(0));
    await this.DPIEnv.DPIToken.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
    await this.liquidityMigration
      .connect(holder2)
      .stakeLpTokens(this.DPIEnv.DPIToken.address, holder2Balance, AcceptedProtocols.DefiPulseIndex);
    expect((await this.liquidityMigration.stakes(holder2Address, this.DPIEnv.DPIToken.address))[0]).to.equal(
      holder2Balance,
    );
  });

  it("Should migrate tokens to strategy", async function () {
    const routerContract = this.ensoEnv.routers[0].contract;
    const holder3 = await this.DPIEnv.holders[2];
    const holder3Address = await holder3.getAddress();

    // staking the tokens in the liquidity migration contract
    const holder3BalanceBefore = await this.DPIEnv.DPIToken.balanceOf(holder3Address);
    expect(holder3BalanceBefore).to.be.gt(BigNumber.from(0));

    await this.DPIEnv.DPIToken.connect(holder3).approve(this.liquidityMigration.address, holder3BalanceBefore);
    await this.liquidityMigration
      .connect(holder3)
      .stakeLpTokens(this.DPIEnv.DPIToken.address, holder3BalanceBefore, AcceptedProtocols.DefiPulseIndex);
    const amount = (await this.liquidityMigration.stakes(holder3Address, this.DPIEnv.DPIToken.address))[0];
    expect(amount).to.be.gt(BigNumber.from(0));
    const holder3BalanceAfter = await this.DPIEnv.DPIToken.balanceOf(holder3Address);
    expect(holder3BalanceAfter).to.be.equal(BigNumber.from(0));

    // Setup migration calls using DPIAdapter contract
    const adapterData = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "address"],
      [this.DPIEnv.DPIToken.address, amount, routerContract.address],
    );
    const migrationCalls: Multicall[] = await this.DPIEnv.adapter.encodeExecute(adapterData);

    // // Setup transfer of tokens from router to strategy
    const transferCalls = [] as Multicall[];
    const underlyingTokens = await this.DPIEnv.DPIToken.getComponents();
    // TODO: Dipesh to discuss the follwoing with Peter why do we need the transferCalls array
    for (let i = 0; i < underlyingTokens.length; i++) {
      transferCalls.push(encodeSettleTransfer(routerContract, underlyingTokens[i], this.strategy.address));
    }
    // // Encode multicalls for GenericRouter
    const calls: Multicall[] = [...migrationCalls, ...transferCalls];
    const migrationData = await routerContract.encodeCalls(calls);
    // // Migrate
    await this.liquidityMigration
      .connect(holder3)
      .migrate(this.strategy.address, this.DPIEnv.DPIToken.address, AcceptedProtocols.DefiPulseIndex, migrationData, 0);
    const [total] = await this.ensoEnv.enso.oracle.estimateTotal(this.strategy.address, underlyingTokens);
    expect(total).to.gt(0);
    expect(await this.strategy.balanceOf(holder3Address)).to.gt(0);
  });
});
