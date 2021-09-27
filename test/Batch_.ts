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
import { EnsoBuilder, Position, Multicall, StrategyState, StrategyItem, encodeSettleTransfer, ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "@enso/contracts";
import { TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE } from "hardhat/builtin-tasks/task-names";
import { WETH, SUSD, DIVISOR, STRATEGY_STATE } from "../src/constants";
import { setupStrategyItems } from "../src/utils"
import { AnyRecord } from "dns";
import { Address } from "cluster";
import { any } from "hardhat/internal/core/params/argumentTypes";

describe("Batch: Unit tests", function () {
    let signers: any,
        adapters: any,
        enso: any,
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
        signers = {} as Signers;
        const allSigners = await ethers.getSigners();
        signers.default = allSigners[0];
        signers.admin = allSigners[10];

        enso = await new EnsoBuilder(signers.admin).mainnet().build();

        // KNC not on Uniswap, use Chainlink
        await enso.platform.oracles.protocols.chainlinkOracle.connect(signers.admin).addOracle(SUSD, WETH, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', true); //sUSD
        await enso.platform.oracles.protocols.chainlinkOracle.connect(signers.admin).addOracle('0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202', SUSD, '0xf8ff43e991a81e6ec886a3d281a2c6cc19ae70fc', false); //KNC
        await enso.platform.strategyFactory.connect(signers.admin).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.SYNTH, '0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202') //Synth estimator uses Chainlink, but otherwise will be treated like a basic token

        await dpi_setup()
        await piedao_setup()
        await indexed_setup()

        const liquidityMigrationBuilder = await new LiquidityMigrationBuilder(signers.admin, enso);
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
        dpiEnv = await new TokenSetEnvironmentBuilder(signers.default, enso).connect(
          TOKENSET_ISSUANCE_MODULES[FACTORY_REGISTRIES.DPI].BASIC,
          TOKENSET_ISSUANCE_MODULES[FACTORY_REGISTRIES.DPI].NAV,
          FACTORY_REGISTRIES.DPI
        );
        dpiUnderlying  = await dpiEnv.tokenSet.getComponents();
        dpiStrategy = IStrategy__factory.connect(
            await deployStrategy(
                "DPI",
                "DPI",
                await setupStrategyItems(enso.platform.oracles.ensoOracle, enso.adapters.uniswap.contract.address, dpiEnv.tokenSet.address, dpiUnderlying),
                STRATEGY_STATE
            ),
            signers.default
        )
        dpiPool = dpiEnv.tokenSet
    }

    const piedao_setup = async function () {
        pieEnv = await new PieDaoEnvironmentBuilder(signers.default).connect();
        //console.log('Pools:', pieEnv.pools)
        pieUnderlying = pieEnv.pools[0].tokens
        pieStrategy = IStrategy__factory.connect(
            await deployStrategy(
                "pie",
                "pie",
                await setupStrategyItems(enso.platform.oracles.ensoOracle, enso.adapters.uniswap.contract.address, await pieEnv.pools[0].contract.getBPool(), pieUnderlying),
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
            await deployStrategy(
                "indexed",
                "inde",
                await setupStrategyItems(enso.platform.oracles.ensoOracle, enso.adapters.uniswap.contract.address, indexedEnv.degenIndexPool.address, indexedUnderlying),
                STRATEGY_STATE
            ),
            signers.default
        )
        indexedPool = IERC20__factory.connect(indexedEnv.degenIndexPool.address, signers.default);
    }

    const deployStrategy = async (name: string, symbol: string, items: StrategyItem[], state: StrategyState) => {
        const tx = await enso.platform.strategyFactory.createStrategy(
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
