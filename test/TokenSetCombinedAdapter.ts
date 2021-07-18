import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { Contract, BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20, IERC20__factory, IStrategy__factory } from "../typechain";

import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { FACTORY_REGISTRIES, TOKENSET_ISSUANCE_MODULES } from "../src/constants";
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";
import { WETH, DIVISOR, STRATEGY_STATE } from "../src/constants";

describe("DPI: Unit tests", function () {
    // lets create a strategy and then log its address and related stuff
    before(async function () {
      this.signers = {} as Signers;
      const signers = await ethers.getSigners();
      this.signers.default = signers[0];
      this.signers.admin = signers[10];
  
      this.ensoEnv = await new EnsoBuilder(this.signers.admin).mainnet().build();
    
      this.TSEnv = await new TokenSetEnvironmentBuilder(this.signers.default, this.ensoEnv).connect(
        TOKENSET_ISSUANCE_MODULES[FACTORY_REGISTRIES.DPI],
        [FACTORY_REGISTRIES.DPI, FACTORY_REGISTRIES.ETH_USD_YIELD],
      );
  
      console.log(`TokenSets Adapter: ${this.TSEnv.adapter.address}`);  // since there will be only 1 Adapter for DPI and ETH_USD_YIELD
  
      const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.ensoEnv);
      liquidityMigrationBuilder.addAdapter(AcceptedProtocols.TokenSets, this.TSEnv.adapter);
      const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
      if (liquitityMigrationDeployed != undefined) {
        console.log(`Liquidity Migration: ${liquitityMigrationDeployed.address}`);
      } else {
        console.log(`Liquidity Migration is undefined`);
      }
  
      this.liquidityMigration = liquidityMigrationBuilder.liquidityMigration;
  
      const underlyingTokensArray: string[][] = [];

      this.TSEnv.tokenSet.forEach((element: Contract) => {
        const underlyingTokens = await element.getComponents();
        underlyingTokensArray.push(underlyingTokens);
      });

      // creating the Positions array (that is which token holds how much weigth)
      const positionsArray: Position[][];
      const positions = [] as Position[];
      for (let index = 0; index < underlyingTokensArray.length; index++) {
            const underlyingTokens = underlyingTokensArray[i];
            const [total, estimates] = await this.ensoEnv.enso.uniswapOracle.estimateTotal(
            this.TSEnv.tokenSet[index].address,
            underlyingTokens
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
      }
      
      
      
      if (positions.findIndex(pos => pos.token.toLowerCase() == WETH.toLowerCase()) == -1) {
        positions.push({
          token: WETH,
          percentage: BigNumber.from(0),
        });
      }
  
      // creating a strategy
      const strategyItems = prepareStrategy(positions, this.ensoEnv.adapters.uniswap.contract.address);
  
      const tx = await this.ensoEnv.enso.strategyFactory.createStrategy(
        this.signers.default.address,
        "DPI",
        "DPI",
        strategyItems,
        STRATEGY_STATE,
        ethers.constants.AddressZero,
        '0x',
      );
      const receipt = await tx.wait();
      const strategyAddress = receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
      console.log("Strategy address: ", strategyAddress);
      this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
    });