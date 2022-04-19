import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Contract, Event } from "ethers";
import { Signers } from "../types";
import { LiquidityMigrationBuilderV2 } from "../src/liquiditymigrationv2";
import { IERC20__factory, IStrategy__factory, IUniswapV3Router__factory } from "../typechain";
import { AcceptedProtocols, Adapters } from "../src/types";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { FACTORY_REGISTRIES, TOKENSET_ISSUANCE_MODULES, UNISWAP_V3_ROUTER, DEPOSIT_SLIPPAGE } from "../src/constants";
import { estimateTokens, increaseTime } from "../src/utils";
import { liveMigrationContract, impersonateWithEth, getAdapterFromType } from "../src/mainnet";
import {
  Position,
  Multicall,
  Tokens,
  InitialState,
  getLiveContracts,
  prepareStrategy,
  encodeSettleTransfer,
  deployLeverage2XAdapter,
} from "@ensofinance/v1-core";

const { WeiPerEther } = ethers.constants;
const ENSO_DEPLOYER = "0x77b59E6CcDB8962192e48a848fdeaf6c0796Afa4";
const ENSO_CONTRACTS_MULTISIG = "0xca702d224d61ae6980c8c7d4d98042e22b40ffdb";
const ENSO_TREASURY_MULTISIG = "0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F";

const INITIAL_STATE: InitialState = {
  timelock: BigNumber.from(60), // 1 minute
  rebalanceThreshold: BigNumber.from(50), // 5%
  rebalanceSlippage: BigNumber.from(990), // 99.0 %
  restructureSlippage: BigNumber.from(985), // 98.5 %
  performanceFee: BigNumber.from(0),
  social: true,
  set: false,
};

describe("BTC_2X: Live tests", function () {
  // lets create a strategy and then log its address and related stuff
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.treasury = await impersonateWithEth(ENSO_TREASURY_MULTISIG, WeiPerEther.mul(10));
    this.signers.admin = await impersonateWithEth(ENSO_CONTRACTS_MULTISIG, WeiPerEther.mul(10));
    this.signers.deployer = await impersonateWithEth(ENSO_DEPLOYER, WeiPerEther.mul(10));

    this.tokens = new Tokens();
    this.enso = await getLiveContracts(this.signers.admin);

    const aaveV2 = this.enso.adapters.aaveV2;
    const addressesProvider = new Contract(await aaveV2.addressesProvider(), [], this.signers.admin);
    const leverageAdapter = await deployLeverage2XAdapter(
      this.signers.admin,
      this.enso.adapters.uniswapV3,
      this.enso.adapters.aaveV2,
      this.enso.adapters.aaveV2Debt,
      addressesProvider,
      new Contract(this.tokens.usdc, [], this.signers.admin),
      new Contract(this.tokens.weth, [], this.signers.admin),
    );
    this.enso.adapters.leverage = leverageAdapter;

    await this.enso.platform.administration.whitelist.connect(this.signers.admin).approve(leverageAdapter.address);

    const { uniswapV3Registry } = this.enso.platform.oracles.registries;
    await uniswapV3Registry
      .connect(this.signers.deployer)
      .addPool(FACTORY_REGISTRIES.BTC_2X, this.tokens.wbtc, "10000");
    await uniswapV3Registry.connect(this.signers.deployer).addPool(this.tokens.wbtc, this.tokens.usdc, "3000");
    await uniswapV3Registry.connect(this.signers.deployer).addPool(this.tokens.wbtc, this.tokens.weth, "3000");

    this.liquidityMigration = await liveMigrationContract(this.signers.treasury);
    this.indexCoopAdapter = await getAdapterFromType(Adapters.IndexCoopAdapter, this.signers.treasury);

    await this.indexCoopAdapter
      .connect(this.signers.treasury)
      .updateLeverageAdapter(this.enso.adapters.leverage.address);
    await this.indexCoopAdapter.connect(this.signers.treasury).updateGenericRouter(this.enso.routers.multicall.address);

    const MigrationControllerImplementation = await ethers.getContractFactory("MigrationController");
    const migrationControllerImplementation = await MigrationControllerImplementation.deploy(
      this.enso.platform.strategyFactory.address,
      this.liquidityMigration.address,
      this.signers.default.address,
    );
    await migrationControllerImplementation.deployed();
    await this.enso.platform.controller["updateAddresses()"]();

    // Upgrade controller to new implementation
    await this.enso.platform.administration.platformProxyAdmin
      .connect(this.signers.admin)
      .upgrade(this.enso.platform.controller.address, migrationControllerImplementation.address);

    await this.liquidityMigration
      .connect(this.signers.treasury)
      .updateController(this.enso.platform.controller.address);
    await this.liquidityMigration
      .connect(this.signers.treasury)
      .updateGenericRouter(this.enso.routers.multicall.address); // this is multicall router
  });

  it("Create strategy", async function () {
    const positions = [
      {
        token: this.tokens.aWBTC,
        percentage: BigNumber.from(2000),
        adapters: [this.enso.adapters.aaveV2.address],
        path: [],
        cache: ethers.utils.defaultAbiCoder.encode(
          ["uint16"],
          [500], // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
        ),
      },
      {
        token: this.tokens.debtUSDC,
        percentage: BigNumber.from(-1000),
        adapters: [
          this.enso.adapters.aaveV2Debt.address,
          this.enso.adapters.uniswapV3.address,
          this.enso.adapters.aaveV2.address,
        ],
        path: [this.tokens.usdc, this.tokens.weth],
        cache: ethers.utils.defaultAbiCoder.encode(["address"], [this.tokens.aWBTC]),
      },
    ];
    const strategyItems = prepareStrategy(positions, this.enso.adapters.uniswapV3.address);

    // deploy strategy
    const tx = await this.enso.platform.strategyFactory
      .connect(this.signers.default)
      .createStrategy(
        this.signers.default.address,
        "BTC_2X",
        "BTC_2X",
        strategyItems,
        INITIAL_STATE,
        this.enso.adapters.leverage.address,
        "0x",
      );

    const receipt = await tx.wait();
    const strategyAddress = receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
    this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);

    await this.liquidityMigration
      .connect(this.signers.treasury)
      ["setStrategy(address,address)"](FACTORY_REGISTRIES.BTC_2X, this.strategy.address);
  });

  it("Should migrate tokens to strategy", async function () {
    console.log("Total staked: ", (await this.liquidityMigration.totalStaked(FACTORY_REGISTRIES.BTC_2X)).toString());

    // Unlock
    await increaseTime(24 * 60 * 60);

    // Migrate
    let tx = await this.liquidityMigration
      .connect(this.signers.treasury)
      ["migrateAll(address,address)"](FACTORY_REGISTRIES.BTC_2X, this.indexCoopAdapter.address);
    let receipt = await tx.wait();
    console.log("Gas Used `migrateAll`: ", receipt.gasUsed.toString());

    const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, this.strategy.address, [
      this.tokens.aWBTC,
      this.tokens.debtUSDC,
    ]);
    expect(total).to.gt(0);
  });
});
