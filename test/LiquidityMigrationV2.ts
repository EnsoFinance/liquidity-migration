import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BigNumber, Event, constants } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, Adapters } from "../src/types";
import { liveMigrationContract, getAdapterFromType, impersonateWithEth, readTokenHolders } from "../src/mainnet";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { getLiveContracts, InitialState, StrategyItem, ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "@ensofinance/v1-core";
import { FACTORY_REGISTRIES, INITIAL_STATE, WETH, SUSD, UNISWAP_V3_ROUTER, ENSO_MULTISIG } from "../src/constants";
import { setupStrategyItems, getBlockTime } from "../src/utils";
import { LP_TOKEN_WHALES } from "../tasks/initMasterUser";
import { IERC20__factory } from "../typechain";
import Strategy from "@ensofinance/v1-core/artifacts/contracts/Strategy.sol/Strategy.json";
const { WeiPerEther } = constants;

describe("LiquidityMigrationV2", function () {
  let signers: any,
    enso: any,
    indexCoopAdapter: any,
    dpiEnv: any,
    dpiPool: any,
    dpiUnderlying: any,
    dpiStrategy: any,
    liquidityMigration: any,
    holders: any;

  const dpi_setup = async function () {
    dpiEnv = await new TokenSetEnvironmentBuilder(signers.admin, enso).connect(FACTORY_REGISTRIES.DPI);
    indexCoopAdapter = await getAdapterFromType(Adapters.IndexCoopAdapter, signers.admin);
    console.log("Adapter: ", indexCoopAdapter.address);
    dpiPool = dpiEnv.pool;
    dpiUnderlying = await indexCoopAdapter.outputTokens(dpiPool.address);
  };

  const dpiStrategy_setup = async function () {
    console.log("dpi pool address", dpiPool.address);
    console.log("dpc underlying: ", dpiUnderlying);
    dpiStrategy = new ethers.Contract(
      await deployStrategy(
        "DPI",
        "DPI",
        await setupStrategyItems(
          enso.platform.oracles.ensoOracle,
          enso.adapters.uniswapV3.address,
          dpiPool.address,
          dpiUnderlying,
        ),
        INITIAL_STATE,
      ),
      Strategy.abi,
      signers.admin,
    );
    console.log("Strategy: ", dpiStrategy.address);
  };

  const deployStrategy = async (name: string, symbol: string, items: StrategyItem[], state: InitialState) => {
    const tx = await enso.platform.strategyFactory.createStrategy(
      signers.admin.address,
      name,
      symbol,
      items,
      state,
      ethers.constants.AddressZero,
      "0x",
    );
    const receipt = await tx.wait();
    return receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
  };

  before(async function () {
    signers = {} as Signers;
    const allSigners = await ethers.getSigners();
    signers.default = allSigners[0];
    signers.secondary = allSigners[1];
    signers.admin = await impersonateWithEth(ENSO_MULTISIG, WeiPerEther.mul(10)) 
    console.log("Admin: ", signers.admin.address);
    holders = readTokenHolders()
    console.log("holders", holders)
    enso = await getLiveContracts(signers.admin);

    // KNC not on Uniswap, use Chainlink
    await enso.platform.oracles.registries.chainlinkRegistry
      .connect(signers.admin)
      .addOracle(SUSD, WETH, "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", true); //sUSD
    await enso.platform.oracles.registries.chainlinkRegistry
      .connect(signers.admin)
      .addOracle(
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202",
        SUSD,
        "0xf8ff43e991a81e6ec886a3d281a2c6cc19ae70fc",
        false,
      ); //KNC
     console.log("Owner ", await enso.platform.strategyFactory.owner())
    await enso.platform.strategyFactory
      .connect(signers.admin)
      .addItemToRegistry(
        ITEM_CATEGORY.BASIC,
        ESTIMATOR_CATEGORY.CHAINLINK_ORACLE,
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202",
      );

    console.log("Controller: ", enso.platform.controller.address);
    console.log("LoopRouter: ", enso.routers.loop.address);
    console.log("FullRouter: ", enso.routers.full.address);
    console.log("Oracle: ", enso.platform.oracles.ensoOracle.address);

    await dpi_setup();
    liquidityMigration = await liveMigrationContract(signers.admin);
    console.log("LiquidityMigration: ", liquidityMigration.address)
    //await indexCoopAdapter.connect(signers.admin).add(dpiPool.address);

    // Upgrade StrategyController to MigrationController
    const MigrationController = await ethers.getContractFactory("MigrationController");
    const migrationControllerImplementation = await MigrationController.connect(signers.admin).deploy(
      enso.platform.strategyFactory.address,
      liquidityMigration.address,
      signers.admin.address,
    );
    await migrationControllerImplementation.deployed();
    // Upgrade controller to new implementation

    await dpiStrategy_setup();
  });

  it("Buy tokens", async function () {
      console.log("DPI: ", dpiPool.address)
    await dpiEnv.adapter
      .connect(signers.admin)
      .buy(dpiPool.address, UNISWAP_V3_ROUTER, 0, ethers.constants.MaxUint256, { value: ethers.constants.WeiPerEther });

    expect(await dpiPool.balanceOf(signers.admin.address)).to.be.gt(BigNumber.from(0));
  });

  it("Stake", async function () {
    const user = await signers.default.getAddress();
    const dpiBalance = await dpiPool.balanceOf(user);

    await dpiPool.connect(signers.default).approve(liquidityMigration.address, dpiBalance);

    await liquidityMigration.connect(signers.default).stake(dpiPool.address, dpiBalance, indexCoopAdapter.address);
    expect(await liquidityMigration.staked(user, dpiPool.address)).to.be.gt(BigNumber.from(0));
  });

  it("Buy and Stake", async function () {
    const amount = ethers.constants.WeiPerEther;
    const value = BigNumber.from(3).mul(amount);
    await liquidityMigration
      .connect(signers.secondary)
      .buyAndStake(dpiPool.address, indexCoopAdapter.address, UNISWAP_V3_ROUTER, 0, ethers.constants.MaxUint256, {
        value: value,
      });
    const user = await signers.secondary.getAddress();
    expect(await liquidityMigration.staked(user, dpiPool.address)).to.be.gt(BigNumber.from(0));
  });

  it("Batch stake", async function () {
    const lp1 = LP_TOKEN_WHALES[2].lpTokenAddress;
    const lp2 = LP_TOKEN_WHALES[3].lpTokenAddress;

    // Add to whitelist
    await indexCoopAdapter.connect(signers.admin).add(lp1);
    await indexCoopAdapter.connect(signers.admin).add(lp2);

    await indexCoopAdapter
      .connect(signers.default)
      .buy(lp1, UNISWAP_V3_ROUTER, 0, ethers.constants.MaxUint256, { value: ethers.constants.WeiPerEther });
    await indexCoopAdapter
      .connect(signers.default)
      .buy(lp2, UNISWAP_V3_ROUTER, 0, ethers.constants.MaxUint256, { value: ethers.constants.WeiPerEther });

    const lp1Token = IERC20__factory.connect(lp1, signers.default);
    const lp1Balance = await lp1Token.balanceOf(signers.default.address);
    await lp1Token.approve(liquidityMigration.address, lp1Balance);
    const lp2Token = IERC20__factory.connect(lp2, signers.default);
    const lp2Balance = await lp1Token.balanceOf(signers.default.address);
    await lp2Token.approve(liquidityMigration.address, lp2Balance);

    await liquidityMigration
      .connect(signers.default)
      .batchStake([lp1, lp2], [lp1Balance, lp2Balance], indexCoopAdapter.address);
    expect(await liquidityMigration.staked(signers.default.address, lp1)).to.be.gt(BigNumber.from(0));
    expect(await liquidityMigration.staked(signers.default.address, lp2)).to.be.gt(BigNumber.from(0));
  });

  it("Should update migration contract", async function () {
    await liquidityMigration.connect(signers.admin).updateController(enso.platform.controller.address);
    await liquidityMigration.connect(signers.admin).updateGenericRouter(enso.routers[0].contract.address);
    await liquidityMigration.connect(signers.admin).updateUnlock(await getBlockTime(0));
  });

  it("Should migrate all LP users", async function () {
    const eventFilter = liquidityMigration.filters.Staked(null, null, null, null);
    const events = await liquidityMigration.queryFilter(eventFilter);
    const stakers = events
      .filter((ev: Event) => ev?.args?.strategy.toLowerCase() === dpiPool.address.toLowerCase())
      .filter((ev: Event) => ev?.args?.amount.gt(0))
      .map((ev: Event) => ev?.args?.account);

    const users = stakers.filter((account: string, index: number) => stakers.indexOf(account) === index);

    console.log("Num users: ", users.length);

    await liquidityMigration.connect(signers.admin).setStrategy(dpiPool.address, dpiStrategy.address);
    const tx = await liquidityMigration.connect(signers.admin).migrateAll(dpiPool.address, indexCoopAdapter.address);
    const receipt = await tx.wait();
    console.log("Migrate Gas Used: ", receipt.gasUsed.toString());
  });
});
