import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory, IStrategy__factory } from "../typechain";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { FACTORY_REGISTRIES, DEPOSIT_SLIPPAGE, INITIAL_STATE} from "../src/constants";
import { EnsoBuilder, InitialState, StrategyItem, ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "@enso/contracts";
import { WETH, SUSD, UNISWAP_V2_ROUTER } from "../src/constants";
import { setupStrategyItems, getBlockTime } from "../src/utils";

const ownerMultisig = '0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F'
const dpiPoolAddress = '0x1494ca1f11d487c2bbe4543e90080aeba4ba3c2b'
const indexCoopAdapterAddress = '0x9c9326C521895c78414BD3C2945e47AFC4Ef16cc'

describe("Batch: Unit tests", function () {
  let signers: any,
    enso: any,
    indexCoopAdapter: any,
    dpiPool: any,
    dpiUnderlying: any,
    dpiStrategy: any,
    liquidityMigration: any,
    mockController: any,
    migrationAdapter: any,
    mockLiquidityMigration: any;

  const dpi_setup = async function () {
    const TokenSetAdapter = await ethers.getContractFactory('TokenSetAdapter')
    indexCoopAdapter = TokenSetAdapter.attach(indexCoopAdapterAddress)
    dpiPool = IERC20__factory.connect(dpiPoolAddress, signers.default)
    dpiUnderlying = await indexCoopAdapter.outputTokens(dpiPoolAddress)
    dpiStrategy = IStrategy__factory.connect(
      await deployStrategy(
        "DPI",
        "DPI",
        await setupStrategyItems(
          enso.platform.oracles.ensoOracle,
          enso.adapters.uniswap.contract.address,
          dpiPoolAddress,
          dpiUnderlying,
        ),
        INITIAL_STATE
      ),
      signers.default,
    );
    console.log("Strategy: ", dpiStrategy.address)
  };

  const deployStrategy = async (name: string, symbol: string, items: StrategyItem[], state: InitialState) => {
    const tx = await enso.platform.strategyFactory.createStrategy(
      signers.default.address,
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

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ownerMultisig],
    });
    signers.admin = await ethers.getSigner(ownerMultisig);
    console.log("Admin: ", signers.admin.address)

    const LiquidityMigration = await ethers.getContractFactory('LiquidityMigration')
    liquidityMigration = LiquidityMigration.attach('0x0092DECCA5E2f26466289011ad41465763BeA4cE')

    enso = await new EnsoBuilder(signers.admin).mainnet().build();
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
    await enso.platform.strategyFactory
      .connect(signers.admin)
      .addItemToRegistry(
        ITEM_CATEGORY.BASIC,
        ESTIMATOR_CATEGORY.CHAINLINK_ORACLE,
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202");

    await dpi_setup();

    console.log("Controller: ", enso.platform.controller.address)
    console.log("Router: ", enso.routers[0].contract.address)
    console.log("Oracle: ", enso.platform.oracles.ensoOracle.address)
  });

  it("Should deploy new liquidity migration contract", async function () {
    const MockLiquidityMigration = await ethers.getContractFactory('MockLiquidityMigration')
    mockLiquidityMigration = await MockLiquidityMigration.deploy(
      enso.platform.controller.address,
      ethers.constants.MaxUint256,
      ethers.constants.MaxUint256,
      signers.admin.address
    )

    const MockController = await ethers.getContractFactory('MockController')
    const mockControllerImplementation = await MockController.connect(signers.admin).deploy(mockLiquidityMigration.address, signers.admin.address)
    await mockControllerImplementation.deployed()
    // Upgrade controller to new implementation
    await enso.platform.administration.controllerAdmin.connect(signers.admin).upgrade(enso.platform.controller.address, mockControllerImplementation.address)
    mockController = await MockController.attach(enso.platform.controller.address)
  })

  it("Should update old migration contract", async function () {
    const MigrationAdapter = await ethers.getContractFactory('MigrationAdapter')
    migrationAdapter = await MigrationAdapter.connect(signers.admin).deploy(signers.admin.address)
    await migrationAdapter.deployed()
    await migrationAdapter.connect(signers.admin).add(dpiPoolAddress)
    // Switch out real adapter for mock adapter to facilitate migration
    await liquidityMigration.connect(signers.admin).removeAdapter(indexCoopAdapter.address)
    await liquidityMigration.connect(signers.admin).addAdapter(migrationAdapter.address)
    // Set controller and generic to new liquidity migration address, which implements the Migrator contract
    await liquidityMigration.connect(signers.admin).updateController(mockLiquidityMigration.address)
    await liquidityMigration.connect(signers.admin).updateGeneric(mockLiquidityMigration.address)
    await liquidityMigration.connect(signers.admin).updateUnlock(await getBlockTime(0))
  })

  it("Should batch migrate", async function () {
    const eventFilter = liquidityMigration.filters.Staked(null, null, null, null)
    const events = await liquidityMigration.queryFilter(eventFilter)
    const stakers = events.filter((ev: Event) => ev?.args?.strategy.toLowerCase() === dpiPoolAddress.toLowerCase())
                          .filter((ev: Event) => ev?.args?.amount.gt(0))
                          .map((ev: Event) => ev?.args?.account)

    const users = stakers.filter((account: string, index: number) => stakers.indexOf(account) === index)
                         .slice(0,150)

    console.log("Num users: ", users.length)
    const stakes = []
    for ( let i = 0; i < users.length; i++ ) {
      const stake = await liquidityMigration.staked(users[i], dpiPoolAddress)
      stakes.push(stake);
      //console.log('Stake: ', stake.toString())
    }
    const lps = Array(users.length).fill(dpiPoolAddress)
    const adapters = Array(users.length).fill(migrationAdapter.address)
    const strategies = Array(users.length).fill(mockLiquidityMigration.address)
    const slippage = Array(users.length).fill(0)
    let tx = await liquidityMigration
      .connect(signers.admin)
      ["batchMigrate(address[],address[],address[],address[],uint256[])"](
        users,
        lps,
        adapters,
        strategies,
        slippage
      );
    let receipt = await tx.wait()
    console.log('Migration Gas Used: ', receipt.gasUsed.toString())

    tx = await mockLiquidityMigration
      .connect(signers.admin)
      .batchSetStake(
        users,
        lps,
        stakes
      )
    receipt = await tx.wait()
    console.log('Batch Set Stake Gas Used: ', receipt.gasUsed.toString())

    // Unlock new liquidity migration contract and batch migrate
    await mockLiquidityMigration.connect(signers.admin).updateUnlock(await getBlockTime(0))

    tx = await mockLiquidityMigration
      .connect(signers.admin)
      .batchMigrate(
        users,
        dpiPoolAddress,
        dpiStrategy.address
      )
    receipt = await tx.wait()
    console.log('Batch Migrate Gas Used: ', receipt.gasUsed.toString())
    const [total, ] = await enso.platform.oracles.ensoOracle.estimateStrategy(dpiStrategy.address)
    // DPI is not part of strategy structure, so it will not be evaluated
    expect(total).to.equal(ethers.BigNumber.from(0))
    expect(await dpiPool.balanceOf(dpiStrategy.address)).to.be.gt(ethers.BigNumber.from(0))
  });

  it("Should finalize migration", async function () {
    // IndexCoopAdapter needs the real GenericRouter address
    await indexCoopAdapter.connect(signers.admin).updateGenericRouter(enso.routers[0].contract.address)

    const tx = await mockController.connect(signers.admin).finalizeMigration(
      dpiStrategy.address,
      enso.routers[0].contract.address,
      indexCoopAdapter.address, //Note this is the current adapter address, not mock. We will reused the migration encoding
      dpiPoolAddress
    )
    const receipt = await tx.wait()
    console.log('Finalize Migrate Gas Used: ', receipt.gasUsed.toString())
    const [total, ] = await enso.platform.oracles.ensoOracle.estimateStrategy(dpiStrategy.address)
    console.log("Strategy value: ", total.toString())
    expect(total).to.be.gt(ethers.BigNumber.from(0))
    expect(await dpiPool.balanceOf(dpiStrategy.address)).to.equal(ethers.BigNumber.from(0))
  })
});
