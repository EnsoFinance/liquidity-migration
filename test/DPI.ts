import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js"
import { BigNumber, Contract, Event } from "ethers";
import { Signers, MainnetSigner } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { ClashingImplementation, IERC20, IERC20__factory, IStrategy__factory } from "../typechain";


import { DPIEnvironmentBuilder } from "../src/dpi";
import { StrategyBuilder, Position } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";
import { DIVISOR, THRESHOLD, TIMELOCK, SLIPPAGE } from "../src/constants";
import { object } from "underscore";

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
      const percentage = (new bignumber(estimates[i].toString())).multipliedBy(DIVISOR).dividedBy(total.toString()).toFixed(0);
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
    const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
    console.log('Strategy address: ', strategyAddress)
    this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  });

  it("Token holder should be able to withdraw from pool", async function () {
    // getting holders of DPI Tokens

    const holderBalances: any[] = [];
    for (let i = 0; i < this.DPIEnv.holders.length; i++) {
      holderBalances[i] = {
        holder: await this.DPIEnv.holders[i].getAddress(),
        balance: await this.DPIEnv.DPIToken.balanceOf((await this.DPIEnv.holders[i].getAddress())),
      }
      expect(await this.DPIEnv.DPIToken.balanceOf((await this.DPIEnv.holders[i].getAddress()))).to.gt(BigNumber.from(0));
    };

    // getting the underlying tokens
    const underlyingTokens = await this.DPIEnv.DPIToken.getComponents();
    
  // for (let index = 0; index < underlyingTokens.length; index++) {
  //       const tokenContract = IERC20__factory.connect(underlyingTokens[index], this.signers.default) as IERC20;
  //       const adds = tokenContract.address;
  //       console.log(adds);
  //       holderBalances.forEach(async (e)=>
  //         {
  //           e.underlyingTokenBalances = {}; // creating an empty object
  //           const balance = await tokenContract.balanceOf(e.holder);
  //           console.log(balance);
  //           // adding key value pair to the empty object created
  //           e.underlyingTokenBalances.abc =  "balance";
  //         }
  //       )
  // }

  // console.log(holderBalances);

    // for (let index = 0; index < holderBalances.length; index++) { // holderBalances.length = 3
    //   for (let a = 0; a < underlyingTokens.length; a++) { // underlyingTokens.length = 14
    //       const tokenContract = IERC20__factory.connect(underlyingTokens[a], this.signers.default) as IERC20;
    //       const userBalanceOfUnderlyingToken = await tokenContract.balanceOf(holderBalances[index].holder);
    //       holderBalances[index].underlyingTokenBalances = {
    //         [tokenContract.address]: userBalanceOfUnderlyingToken
    //       }
    //   }
    // }


    // getting the balance of each of the underlying tokens for the holders
    // for (let i = 0; i < underlyingTokens.length; i++) {
    //   // creating the contract
    //   const tokenContract = IERC20__factory.connect(underlyingTokens[i], this.signers.default) as IERC20;
    //   const tempAddress = tokenContract.address;
    //   // console.log(`Getting value for ${tempAddress}`);
    //   // getting balance of the user
    //   for (let index = 0; index < this.DPIEnv.holders.length; index++) {
    //     // console.log(index,`:`, await this.DPIEnv.holders[index].getAddress());
    //     const underlyingTokenBalance = await tokenContract.balanceOf(await this.DPIEnv.holders[index].getAddress());
    //     // console.log(tempAddress, ":", underlyingTokenBalance.toString());
    //     // console.log(underlyingTokenBalance.toString());
    //     holderBalances[index].underlyingTokenBalances = {
    //       tempAddress: underlyingTokenBalance
    //     }
    //     // console.log(tempAddress,":", holderBalances[index].underlyingTokenBalances);
    //   }
    // }
    

    // const tx = await contract.connect(holder).exitPool(holderBalance);
    // await tx.wait();
    // // const receipt = await tx.wait();
    // expect(await contract.balanceOf(await holder.getAddress())).to.eq(BigNumber.from(0));

    // for (let i = 0; i < pool.tokens.length; i++) {
    //   const token = ERC20__factory.connect(pool.tokens[i], this.signers.default);
    //   const balance = await token.balanceOf(await holder.getAddress());
    //   expect(balance).to.gt(tokenBalances[i]);
    // }
    // expect(await contract.totalSupply()).to.eq(totalSupply.sub(holderBalance));
  });
});
