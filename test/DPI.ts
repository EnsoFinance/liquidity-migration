import { ethers } from "hardhat";
import { BigNumber, Contract, Event } from "ethers";
import { Signers, MainnetSigner } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
// import { IStrategy__factory } from "../typechain";
// // import { shouldStakeLPToken, shouldMigrateToStrategy } from "./PieDao.behavior.txt";

import { DPIEnvironmentBuilder } from "../src/dpi";
import { StrategyBuilder, Position } from "@enso/contracts";
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
      positions.push({
        token: underlyingTokens[i],
        percentage: BigNumber.from(estimates[i]).mul(DIVISOR).div(total),
      });
    }

    // creating a strategy

    const s = new StrategyBuilder(positions, this.ensoEnv.adapters.uniswap.contract.address);
    // console.log(s.percentages);
    // const percentagesinNumber: number[] = [];
    // for (let i = 0; i < s.percentages.length; i++) {
    //     percentagesinNumber[i] = s.percentages[i].toNumber();
    // };

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
    console.log(`tx: ${tx}`);

    // const receipt = await tx.wait()
    // console.log(receipt);
    // const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
    // console.log('Strategy address: ', strategyAddress)
    //     this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
  });

  it("Test", async function () {
    console.log("we are in the dpi test");
  });
});
