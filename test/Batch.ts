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
import { WETH, SUSD, DIVISOR, STRATEGY_STATE, UNISWAP_V2_ROUTER } from "../src/constants";
import { setupStrategyItems, encodeMigrationData } from "../src/utils"
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

    const dpi_setup = async function () {
        dpiEnv = await new TokenSetEnvironmentBuilder(signers.admin, enso).connect(
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
        pieEnv = await new PieDaoEnvironmentBuilder(signers.admin).connect();
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
        indexedEnv = await new IndexedEnvironmentBuilder(signers.admin).connect();
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

    before(async function () {
        signers = {} as Signers;
        const allSigners = await ethers.getSigners();
        signers.default = allSigners[0];
        signers.secondary = allSigners[1];
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

        await indexedEnv.adapter.connect(signers.admin).add(indexedPool.address)
        await dpiEnv.adapter.connect(signers.admin).add(dpiPool.address)
        await pieEnv.adapter.connect(signers.admin).add(piePool.address)
    })

    it('Buy tokens', async function () {
      await indexedEnv.adapter.connect(signers.default).buy(indexedPool.address, UNISWAP_V2_ROUTER, 0, ethers.constants.MaxUint256, {value: ethers.constants.WeiPerEther})
      await dpiEnv.adapter.connect(signers.default).buy(dpiPool.address, UNISWAP_V2_ROUTER, 0, ethers.constants.MaxUint256, {value: ethers.constants.WeiPerEther})
      await pieEnv.adapter.connect(signers.default).buy(piePool.address, UNISWAP_V2_ROUTER, 0, ethers.constants.MaxUint256, {value: ethers.constants.WeiPerEther})
      const user = await signers.default.getAddress();
      expect(await indexedPool.balanceOf(user)).to.be.gt(BigNumber.from(0));
      expect(await dpiPool.balanceOf(user)).to.be.gt(BigNumber.from(0));
      expect(await piePool.balanceOf(user)).to.be.gt(BigNumber.from(0));
    });

    it('Batch stake', async function () {
      const user = await signers.default.getAddress();
      const indexedBalance = await indexedPool.balanceOf(user)
      const dpiBalance = await dpiPool.balanceOf(user)
      const pieBalance = await piePool.balanceOf(user)

      await indexedPool.connect(signers.default).approve(liquidityMigration.address, indexedBalance)
      await dpiPool.connect(signers.default).approve(liquidityMigration.address, dpiBalance)
      await piePool.connect(signers.default).approve(liquidityMigration.address, pieBalance)

      await liquidityMigration.connect(signers.default).batchStake(
        [indexedPool.address, dpiPool.address, piePool.address],
        [indexedBalance, dpiBalance, pieBalance],
        [indexedEnv.adapter.address, dpiEnv.adapter.address, pieEnv.adapter.address]
      )
      expect(await liquidityMigration.staked(user, indexedPool.address)).to.be.gt(BigNumber.from(0));
      expect(await liquidityMigration.staked(user, dpiPool.address)).to.be.gt(BigNumber.from(0));
      expect(await liquidityMigration.staked(user, piePool.address)).to.be.gt(BigNumber.from(0));
    })

    it('Batch buy and stake', async function () {
      const amount = ethers.constants.WeiPerEther
      const value = BigNumber.from(3).mul(amount)
      await liquidityMigration.connect(signers.secondary).batchBuyAndStake(
        [indexedPool.address, dpiPool.address, piePool.address],
        [amount, amount, amount],
        [indexedEnv.adapter.address, dpiEnv.adapter.address, pieEnv.adapter.address],
        [UNISWAP_V2_ROUTER, UNISWAP_V2_ROUTER, UNISWAP_V2_ROUTER],
        [0, 0, 0],
        ethers.constants.MaxUint256,
        {value: value}
      )
      const user = await signers.secondary.getAddress();
      expect(await liquidityMigration.staked(user, indexedPool.address)).to.be.gt(BigNumber.from(0));
      expect(await liquidityMigration.staked(user, dpiPool.address)).to.be.gt(BigNumber.from(0));
      expect(await liquidityMigration.staked(user, piePool.address)).to.be.gt(BigNumber.from(0));
    })

    it('Should batch migrate', async function () {
      const user = await signers.default.getAddress();
      await liquidityMigration.connect(signers.default)['batchMigrate(address[],address[],address[])'](
        [indexedPool.address, dpiPool.address, piePool.address],
        [indexedEnv.adapter.address, dpiEnv.adapter.address, pieEnv.adapter.address],
        [indexedStrategy.address, dpiStrategy.address, pieStrategy.address]
      )
    })
    it('Should batch migrate', async function () {
      const user = await signers.secondary.getAddress();
      const indexedMigrationData = await encodeMigrationData(
        indexedEnv.adapter,
        enso.routers[0].contract,
        indexedPool.address,
        indexedStrategy.address,
        await indexedEnv.adapter.outputTokens(indexedPool.address),
        await liquidityMigration.staked(user, indexedPool.address)
      )
      const dpiMigrationData = await encodeMigrationData(
        dpiEnv.adapter,
        enso.routers[0].contract,
        dpiPool.address,
        dpiStrategy.address,
        await dpiEnv.adapter.outputTokens(dpiPool.address),
        await liquidityMigration.staked(user, dpiPool.address)
      )
      const pieMigrationData = await encodeMigrationData(
        pieEnv.adapter,
        enso.routers[0].contract,
        piePool.address,
        pieStrategy.address,
        await pieEnv.adapter.outputTokens(piePool.address),
        await liquidityMigration.staked(user, piePool.address)
      )
      await liquidityMigration.connect(signers.admin)['batchMigrate(address[],address[],address[],address[])'](
        [user, user, user],
        [indexedPool.address, dpiPool.address, piePool.address],
        [indexedEnv.adapter.address, dpiEnv.adapter.address, pieEnv.adapter.address],
        [indexedStrategy.address, dpiStrategy.address, pieStrategy.address]
      )
    })
})
