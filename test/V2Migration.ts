import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory } from "../typechain";
import Strategy from '@enso/contracts/artifacts/contracts/Strategy.sol/Strategy.json'
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { TOKENSET_HOLDERS, INITIAL_STATE } from "../src/constants";
import { EnsoBuilder, InitialState, StrategyItem, ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "@enso/contracts";
import { WETH, SUSD } from "../src/constants";
import { setupStrategyItems, getBlockTime } from "../src/utils";
import deployments from "../deployments.json"

const ownerMultisig = '0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F'
const dpiPoolAddress = '0x1494ca1f11d487c2bbe4543e90080aeba4ba3c2b'
const indexCoopAdapterAddress = deployments.mainnet.IndexCoopAdapter
const adapters: string[] = [
    deployments.mainnet.TokenSetAdapter,
    deployments.mainnet.PieDaoAdapter,
    deployments.mainnet.IndexedAdapter,
    deployments.mainnet.IndexCoopAdapter,
    deployments.mainnet.DHedgeAdapter,
    deployments.mainnet.PowerPoolAdapter,
]

describe("V2 Migration: ", function () {
  let signers: any,
    enso: any,
    indexCoopAdapter: any,
    dpiPool: any,
    dpiUnderlying: any,
    dpiStrategy: any,
    dpiStakers: any,
    liquidityMigration: any,
    liquidityMigrationV2: any,
    migrationAdapter: any,
    migrationCoordinator: any,
    users: any;

  const dpi_setup = async function () {
    const TokenSetAdapter = await ethers.getContractFactory('TokenSetAdapter')
    indexCoopAdapter = TokenSetAdapter.attach(indexCoopAdapterAddress)
    dpiPool = IERC20__factory.connect(dpiPoolAddress, signers.default)
    dpiUnderlying = await indexCoopAdapter.outputTokens(dpiPoolAddress)
    dpiStrategy = new ethers.Contract(
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
      Strategy.abi,
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

    // Not needed for live contract, but we'll set it to check that MigrationCoordinator changes them correctly
    await liquidityMigration.connect(signers.admin).updateController(enso.platform.controller.address)
    await liquidityMigration.connect(signers.admin).updateGeneric(enso.routers[0].contract.address)

    // Get stakers
    const eventFilter = liquidityMigration.filters.Staked(null, null, null, null)
    const events = await liquidityMigration.queryFilter(eventFilter)
    dpiStakers = events.filter((ev: Event) => ev?.args?.strategy.toLowerCase() === dpiPoolAddress.toLowerCase())
                    .filter((ev: Event) => ev?.args?.amount.gt(0))
                    .map((ev: Event) => ev?.args?.account)
    // Filter duplicates
    dpiStakers = dpiStakers.filter((account: string, index: number) => dpiStakers.indexOf(account) === index)
  });

  it("Should deploy new liquidity migration contract", async function () {
    const LiquidityMigrationV2 = await ethers.getContractFactory('LiquidityMigrationV2')
    liquidityMigrationV2 = await LiquidityMigrationV2.connect(signers.admin).deploy(
      adapters,
      ethers.constants.MaxUint256,
      ethers.constants.MaxUint256
    )
    await liquidityMigrationV2.deployed()

    const MigrationAdapter = await ethers.getContractFactory('MigrationAdapter')
    migrationAdapter = await MigrationAdapter.connect(signers.admin).deploy(signers.admin.address)
    await migrationAdapter.deployed()
    // Add all eligible LPs to this adapter's whitelist
    await migrationAdapter.connect(signers.admin).add(dpiPoolAddress)

    const MigrationController = await ethers.getContractFactory('MigrationController')
    const migrationControllerImplementation = await MigrationController.connect(signers.admin).deploy(liquidityMigrationV2.address, signers.admin.address)
    await migrationControllerImplementation.deployed()
    // Upgrade controller to new implementation
    await enso.platform.administration.controllerAdmin.connect(signers.admin).upgrade(
      enso.platform.controller.address,
      migrationControllerImplementation.address
    )
    // Update controller and generic router on LMV2
    await liquidityMigrationV2.connect(signers.admin).updateController(enso.platform.controller.address)
    await liquidityMigrationV2.connect(signers.admin).updateGenericRouter(enso.routers[0].contract.address)

    // Update generic router and leverage adapter on indexCoopAdapter
    await indexCoopAdapter.connect(signers.admin).updateGenericRouter(enso.routers[0].contract.address)
  })

  it("Should setup migration coordinator", async function () {
    // Deploy contract
    const MigrationCoordinator = await ethers.getContractFactory('MigrationCoordinator')
    migrationCoordinator = await MigrationCoordinator.connect(signers.admin).deploy(
       liquidityMigration.address,
       liquidityMigrationV2.address,
       migrationAdapter.address
    )
    await migrationCoordinator.deployed()
    // Update coordinator on LMV2
    await liquidityMigrationV2.connect(signers.admin).updateCoordinator(migrationCoordinator.address)
    // Transfer ownership of LiquidityMigrationV1
    await liquidityMigration.connect(signers.admin).transferOwnership(migrationCoordinator.address)
    // Initiate migration
    await migrationCoordinator.connect(signers.admin).initiateMigration()

    expect(await liquidityMigration.controller()).to.equal(ethers.constants.AddressZero)
    expect(await liquidityMigration.generic()).to.equal(liquidityMigrationV2.address)
  })

  it("Should withdraw lp tokens via coordinator", async function() {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [dpiStakers[0]],
    });
    const user = await ethers.getSigner(dpiStakers[0]);
    const balanceBefore = await dpiPool.balanceOf(user.address)
    await migrationCoordinator.connect(user)
                              .withdraw(dpiPool.address)
    const balanceAfter = await dpiPool.balanceOf(user.address)
    expect(balanceAfter.gt(balanceBefore)).to.equal(true)
    // Remove user from array
    dpiStakers.shift()
  })

  it("Should fail withdraw lp tokens via coordinator: not staking", async function() {
    await expect(
        migrationCoordinator.connect(signers.admin)
                            .withdraw(dpiPool.address)
    ).to.be.revertedWith('LiquidityMigration#_refund: no stake')
  })

  it("Should refund lp tokens via coordinator", async function() {
    const balanceBefore = await dpiPool.balanceOf(dpiStakers[0])
    await migrationCoordinator.connect(signers.admin)
                              .refund(dpiStakers[0], dpiPool.address)
    const balanceAfter = await dpiPool.balanceOf(dpiStakers[0])
    expect(balanceAfter.gt(balanceBefore)).to.equal(true)
    // Remove user from array
    dpiStakers.shift()
  })

  it("Should fail refund lp tokens via coordinator: not owner", async function() {
    await expect(
        migrationCoordinator.connect(signers.default)
                            .refund(dpiStakers[0], dpiPool.address)
    ).to.be.revertedWith('Ownable: caller is not the owner')
  })

  it("Should migrate to new LiquidityMigration contract", async function () {
    const balanceBefore = await dpiPool.balanceOf(liquidityMigrationV2.address)
    users = dpiStakers.slice(0,150)

    console.log("Num users: ", users.length)

    const tx = await migrationCoordinator
      .connect(signers.admin)
      .migrateLP(
        users,
        dpiPoolAddress,
        indexCoopAdapterAddress
      )
    const receipt = await tx.wait()
    console.log('Migrate LP Gas Used: ', receipt.gasUsed.toString())
    const balanceAfter = await dpiPool.balanceOf(liquidityMigrationV2.address)
    expect(balanceAfter.gt(balanceBefore)).to.equal(true)
  });

  it("Should withdraw lp tokens via LMV2", async function() {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [users[0]],
    });
    const user = await ethers.getSigner(users[0]);
    const balanceBefore = await dpiPool.balanceOf(user.address)
    await liquidityMigrationV2.connect(user)
                              .withdraw(dpiPool.address)
    const balanceAfter = await dpiPool.balanceOf(user.address)
    expect(balanceAfter.gt(balanceBefore)).to.equal(true)
    // Remove user from array
    users.shift()
  })

  it("Should fail withdraw lp tokens via LMV2: not staking", async function() {
    await expect(
        liquidityMigrationV2.connect(signers.admin)
                            .withdraw(dpiPool.address)
    ).to.be.revertedWith('No stake')
  })

  it("Should refund lp tokens via LMV2", async function() {
    const balanceBefore = await dpiPool.balanceOf(users[0])
    await liquidityMigrationV2.connect(signers.admin)
                              .refund(users[0], dpiPool.address)
    const balanceAfter = await dpiPool.balanceOf(users[0])
    expect(balanceAfter.gt(balanceBefore)).to.equal(true)
    // Remove user from array
    users.shift()
  })

  it("Should fail refund lp tokens via LMV2: not owner", async function() {
    await expect(
        liquidityMigrationV2.connect(signers.default)
                            .refund(users[0], dpiPool.address)
    ).to.be.revertedWith('Ownable: caller is not the owner')
  })

  it("Should set strategy", async function() {
      await liquidityMigrationV2.setStrategy(dpiPool.address, dpiStrategy.address)
  })

  it("Should fail claim strategy tokens: not claimable", async function() {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [users[0]],
    });
    const user = await ethers.getSigner(users[0]);

    await expect(
        liquidityMigrationV2.connect(user)
                            .claim(dpiPool.address)
    ).to.be.revertedWith('Not yet migrated')
  })

  it("Migrate LP liquidity", async function() {
      // Unlock new liquidity migration contract and batch migrate
      await liquidityMigrationV2.connect(signers.admin).updateUnlock(await getBlockTime(0))

      const tx = await liquidityMigrationV2
        .connect(signers.admin)
        .migrateAll(
          dpiPoolAddress,
          indexCoopAdapterAddress
        )
      const receipt = await tx.wait()
      console.log('Migrate All Gas Used: ', receipt.gasUsed.toString())
      const [total, ] = await enso.platform.oracles.ensoOracle.estimateStrategy(dpiStrategy.address)
      console.log("Strategy value: ", total.toString())
      expect(total).to.be.gt(ethers.BigNumber.from(0))
      expect(await dpiPool.balanceOf(dpiStrategy.address)).to.equal(ethers.BigNumber.from(0))
      console.log("Strategy last token value: ", (await dpiStrategy.getLastTokenValue()).toString())
  })

  it("Should fail refund lp tokens via LMV2: not refundable", async function() {
    await expect(
        liquidityMigrationV2.connect(signers.admin)
                            .refund(users[0], dpiPool.address)
    ).to.be.revertedWith('Not refundable')
  })

  it("Should fail to set strategy", async function() {
    // Error should throw on any valid Enso strategy (in this case its the same as the current set strategy)
    await expect(
        liquidityMigrationV2.connect(signers.admin)
                            .setStrategy(dpiPool.address, dpiStrategy.address)
    ).to.be.revertedWith('Already set')
  })

  it("Should claim strategy tokens", async function() {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [users[0]],
    });
    const user = await ethers.getSigner(users[0]);
    expect(await liquidityMigrationV2.hasStaked(user.address, dpiPool.address)).to.equal(true)
    const balanceBefore = await dpiStrategy.balanceOf(user.address)
    const tx = await liquidityMigrationV2.connect(user).claim(dpiPoolAddress)
    const receipt = await tx.wait()
    console.log('Claim Gas Used: ', receipt.gasUsed.toString())
    const balanceAfter = await dpiStrategy.balanceOf(user.address)
    expect(balanceAfter).to.be.gt(balanceBefore)
    console.log("User paid token value: ", (await dpiStrategy.getPaidTokenValue(user.address)).toString())
    expect(await liquidityMigrationV2.hasStaked(user.address, dpiPool.address)).to.equal(false)
    // Remove from users array
    users.shift()
  })

  it("Should fail transfer LMV1 ownership: not owner", async function() {
    await expect(
        migrationCoordinator.connect(signers.default)
                            .transferLiquidityMigrationOwnership(signers.default.address)
    ).to.be.revertedWith('Ownable: caller is not the owner')
  })

  it("Should transfer LMV1 ownership", async function() {
    await migrationCoordinator.connect(signers.admin)
                              .transferLiquidityMigrationOwnership(signers.admin.address)
    expect(await liquidityMigration.owner()).to.equal(signers.admin.address)
  })

  it("Should add adapter", async function() {
    await liquidityMigrationV2.connect(signers.admin).addAdapter(migrationAdapter.address)
    expect(await liquidityMigrationV2.adapters(migrationAdapter.address)).to.equal(true)
  })

  it("Should remove adapter", async function() {
    await liquidityMigrationV2.connect(signers.admin).removeAdapter(migrationAdapter.address)
    expect(await liquidityMigrationV2.adapters(migrationAdapter.address)).to.equal(false)
  })

  it('Should fail to emergency transfer: not paused', async function() {
    await expect(
        liquidityMigrationV2.connect(signers.admin)
                            .emergencyMigrate(dpiStrategy.address)
    ).to.be.revertedWith('Not paused')
  })

  it('Should fail to pause: not owner', async function() {
    await expect(
        liquidityMigrationV2.connect(signers.default)
                            .pause()
    ).to.be.revertedWith('Ownable: caller is not the owner')
  })

  it('Should pause', async function() {
    await liquidityMigrationV2.connect(signers.admin).pause()
    expect(await liquidityMigrationV2.paused()).to.equal(true)
  })

  it('Should fail to emergency transfer: not owner', async function() {
    await expect(
        liquidityMigrationV2.connect(signers.default)
                            .emergencyMigrate(dpiStrategy.address)
    ).to.be.revertedWith('Ownable: caller is not the owner')
  })

  it('Should fail to emergency transfer: no receiver', async function() {
    await expect(
        liquidityMigrationV2.connect(signers.admin)
                            .emergencyMigrate(dpiStrategy.address)
    ).to.be.revertedWith('Emergency receiver not set')
  })

  it('Should update emergency receiver', async function() {
    await liquidityMigrationV2.connect(signers.admin).updateEmergencyReceiver(signers.admin.address)
    expect(await liquidityMigrationV2.emergencyReceiver()).to.equal(signers.admin.address)
  })

  it('Should fail to emergency transfer: no balance', async function() {
    await expect(
        liquidityMigrationV2.connect(signers.admin)
                            .emergencyMigrate(dpiPool.address)
    ).to.be.revertedWith('No balance')
  })

  it('Should emergency transfer', async function() {
    await liquidityMigrationV2.connect(signers.admin).emergencyMigrate(dpiStrategy.address)
    expect((await dpiStrategy.balanceOf(liquidityMigrationV2.address)).eq(0)).to.equal(true)
  })

  it('Should unpause', async function() {
    await liquidityMigrationV2.connect(signers.admin).unpause()
    expect(await liquidityMigrationV2.paused()).to.equal(false)
  })
});
