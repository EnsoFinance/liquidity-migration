import { ethers } from "hardhat";
import { expect } from "chai";
import bignumber from "bignumber.js";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory, IStrategy__factory } from "../typechain";

import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { FACTORY_REGISTRIES, TOKENSET_ISSUANCE_MODULES } from "../src/constants";
import { EnsoBuilder, Position, Multicall, prepareStrategy, encodeSettleTransfer } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";
import { WETH, DIVISOR, STRATEGY_STATE } from "../src/constants";
import { AnyRecord } from "dns";
import { Address } from "cluster";
import { any } from "hardhat/internal/core/params/argumentTypes";

describe("Indexed: Unit tests", function () {
    let signers: any,
        adapters: any,
        ensoEnv: any,
        dpiEnv: any,
        dpiUnderlying: any,
        dpiStrategy: any,
        dpiPool: any,
        pieEnv: any,
        pieUnderlying: any,
        pieStrategy: any,
        piePool: any,
        indexedEnv: any,
        indexedUnderlying: any,
        indexedStrategy: any,
        indexedPool: any,
        liquidityMigration: any;

    before(async function () {
        this.signers = {} as Signers;
        const signers = await ethers.getSigners();
        this.signers.default = signers[0];
        this.signers.admin = signers[10];

        this.ensoEnv = await new EnsoBuilder(this.signers.admin).mainnet().build();
        await dpi_setup()
        await piedao_setup()
        await indexed_setup()

        const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(this.signers.admin, this.ensoEnv);
        liquidityMigrationBuilder.addAdapters(
            [AcceptedProtocols.Indexed, AcceptedProtocols.DefiPulseIndex, AcceptedProtocols.PieDao],
            [indexedEnv.adapter, dpiEnv.adapter, pieEnv.adapter]
        )

        const liquitityMigrationDeployed = await liquidityMigrationBuilder.deploy();
        liquidityMigration = liquidityMigrationBuilder.liquidityMigration; 
    })
    describe('stake', () => {
        it('non-functional', () => {
            
        });
        it('functional', () => {
            before(async () => {
                batch_stake(
                    [indexedEnv.adapter, dpiEnv.adapter, pieEnv.adapter],
                    [1, 1, 1],
                    [indexedPool, dpiPool, piePool],
                    [, await dpiEnv.holders[1].getAddress(), piePool.holders[0].getAddress()]
                );
            });
        });
    });
    it('', async function () {
        
    });

    const batch_stake = async (adapter: any, amount: any, token: any, from: any) => {
        for (let i = 0; i < amount.length; i++) {
            await token[i].connect(from).approve(liquidityMigration.address, amount[i])
            await liquidityMigration.connect(from).stake(token[i], amount[i], adapter[i])
        }
    }

    const dpi_setup = async function () {
        dpiEnv = await new TokenSetEnvironmentBuilder(signers.default, ensoEnv).connect(TOKENSET_ISSUANCE_MODULES[FACTORY_REGISTRIES.DPI],FACTORY_REGISTRIES.DPI,);
        dpiUnderlying  = await dpiEnv.tokenSet.getComponents();
        dpiStrategy = IStrategy__factory.connect(
            await deploy_strategy(
                "DPI",
                "DPI",
                await prepare_strategy(dpiEnv.adapter, dpiUnderlying),
                STRATEGY_STATE
            ),
            signers.default
        )
        dpiPool = dpiEnv.tokenSet
    }

    const piedao_setup = async function () {
        pieEnv = await new PieDaoEnvironmentBuilder(signers.default).connect();
        pieUnderlying = pieEnv.pools[0].tokens
        pieStrategy = IStrategy__factory.connect(
            await deploy_strategy(
                "pie",
                "pie",
                await prepare_strategy(pieEnv.adapter, pieUnderlying),
                STRATEGY_STATE
            ),
            signers.default
        )
        piePool = await (pieEnv.pools[0]).contract
    }

    const indexed_setup = async function () {
        indexedEnv = await new IndexedEnvironmentBuilder(signers.default).connect();
        indexedUnderlying = await indexedEnv.adapter.outputTokens(indexedEnv.degenIndexPool.address);
        indexedStrategy = IStrategy__factory.connect(
            await deploy_strategy(
                "indexed",
                "inde",
                await prepare_strategy(indexedEnv.adapter, indexedUnderlying),
                STRATEGY_STATE
            ),
            signers.default
        )
        indexedPool = IERC20__factory.connect(indexedEnv.degenIndexPool.address, signers.default);
    }

    const prepare_strategy = async (adapter: any, underlying: any) => {
        let positions = [] as Position[];
        let [total, estimates] = await ensoEnv.enso.uniswapOracle.estimateTotal(adapter, underlying,);
        for (let i = 0; i < underlying.length; i++) {
            const percentage = new bignumber(estimates[i].toString())
              .multipliedBy(DIVISOR)
              .dividedBy(total.toString())
              .toFixed(0);
            positions.push({
              token: underlying[i],
              percentage: BigNumber.from(percentage),
            });
          }
          if (positions.findIndex(pos => pos.token.toLowerCase() == WETH.toLowerCase()) == -1) {
            positions.push({
              token: WETH,
              percentage: BigNumber.from(0),
            });
          }
        return prepareStrategy(positions, ensoEnv.adapters.uniswap.contract.address);
    }

    const deploy_strategy = async (name: any, symbol: any, items: any, state: any) => {
        const tx = await ensoEnv.enso.strategyFactory.createStrategy(
            signers.default.address,
            name,
            symbol,
            items,
            state,
            ethers.constants.AddressZero,
            '0x',
          );
        const receipt = await tx.wait();
        return receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
    }
})