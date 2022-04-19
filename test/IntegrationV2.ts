import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Signer, Contract, Event, constants } from "ethers";
import { Signers } from "../types";
import {
  impersonateAccount,
  getPoolsToMigrate,
  liveMigrationContract,
  impersonateWithEth,
  readTokenHolders,
  getAdapterFromType,
  getAdapterFromAddr,
} from "../src/mainnet";
import { AcceptedProtocols, StakedPool, Adapters } from "../src/types";
import { IPV2SmartPool__factory } from "../typechain";
import {
  toErc20,
  deployStakedStrategy,
  setupStrategyItems,
  encodeStrategyData,
  estimateTokens,
  increaseTime,
  getBlockTime,
} from "../src/utils";
import { getLiveContracts, ITEM_CATEGORY, ESTIMATOR_CATEGORY, Tokens } from "@ensofinance/v1-core";
import { ENSO_MULTISIG, WETH, SUSD, DEPOSIT_SLIPPAGE } from "../src/constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { WeiPerEther } = constants;

const INITIAL_STATE = {
  timelock: BigNumber.from(60), // 1 minute
  rebalanceThreshold: BigNumber.from(50), // 5%
  rebalanceSlippage: BigNumber.from(990), // 99.0 %
  restructureSlippage: BigNumber.from(985), // 98.5 %
  performanceFee: BigNumber.from(0),
  social: true,
  set: false,
};

describe("Stake and Migrate all tokens", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    // Impersonate enso owners and get live v1-core contrats
    this.signers.treasury = await impersonateWithEth("0xca702d224d61ae6980c8c7d4d98042e22b40ffdb", WeiPerEther.mul(10));
    this.enso = getLiveContracts(this.signers.treasury);
    const ensoOwner = await this.enso.platform.strategyFactory.owner();
    this.signers.ensoOwner = await impersonateWithEth(ensoOwner, WeiPerEther.mul(10));
    console.log("Enso owner: ", this.signers.ensoOwner.address);
    this.liquidityMigration = liveMigrationContract(this.signers.ensoOwner);
    const lmOwner = await this.liquidityMigration.owner();
    this.signers.lmOwner = await impersonateWithEth(lmOwner, WeiPerEther.mul(10));
    console.log("Liquidity migration owner: ", this.signers.ensoOwner.address);

    // Get stakes to migrate
    this.poolsToMigrate = await getPoolsToMigrate(this.signers.ensoOwner);
    this.holders = await readTokenHolders();

    // Deploy Migration adapter
    const MigrationAdapter = await ethers.getContractFactory("MigrationAdapter");
    const migrationAdapter = await MigrationAdapter.connect(this.signers.lmOwner).deploy(this.signers.lmOwner.address);
    await migrationAdapter.deployed();

    // Add all eligible LPs to this adapter's whitelist
    this.eligibleLPs = Object.keys(this.poolsToMigrate);
    //console.log("LPS: ", this.eligibleLPs)
    await Promise.all(
      this.eligibleLPs.map(async (lp: string) => migrationAdapter.connect(this.signers.lmOwner).add(lp)),
    );

    // Deploy MigrationController
    const MigrationController = await ethers.getContractFactory("MigrationController");
    this.migrationController = await MigrationController.connect(this.signers.lmOwner).deploy(
      this.enso.platform.strategyFactory.address,
      this.liquidityMigration.address,
      this.signers.lmOwner.address,
    );
    await this.migrationController.deployed();

    await this.enso.platform.controller.connect(this.signers.treasury)["updateAddresses()"]();

    // Upgrade controller to new implementation
    await this.enso.platform.administration.platformProxyAdmin
      .connect(this.signers.treasury)
      .upgrade(this.enso.platform.controller.address, this.migrationController.address);
    //this.enso.platform.controller = this.migrationController
    await this.liquidityMigration.connect(this.signers.lmOwner).updateController(this.enso.platform.controller.address);

    // Update generic router (leverage adapter + liquidity migration)
    await this.liquidityMigration
      .connect(this.signers.lmOwner)
      .updateGenericRouter(this.enso.routers.multicall.address);
    this.indexCoopAdapter = await getAdapterFromType(Adapters.IndexCoopAdapter, this.signers.treasury);
    await this.indexCoopAdapter.connect(this.signers.lmOwner).updateGenericRouter(this.enso.routers.multicall.address);

    // KNC not on Uniswap, use Chainlink
    const { chainlinkRegistry } = this.enso.platform.oracles.registries;
    await chainlinkRegistry
      .connect(this.signers.ensoOwner)
      .addOracle(SUSD, WETH, "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", true); //sUSD
    await chainlinkRegistry
      .connect(this.signers.ensoOwner)
      .addOracle(
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202",
        SUSD,
        "0xf8ff43e991a81e6ec886a3d281a2c6cc19ae70fc",
        false,
      ); //KNC
    await this.enso.platform.strategyFactory
      .connect(this.signers.ensoOwner)
      .addItemToRegistry(
        ITEM_CATEGORY.BASIC,
        ESTIMATOR_CATEGORY.CHAINLINK_ORACLE,
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202",
      );
  });

  /*
  it("Stake all tokens", async function () {
    for (let i = 0; i < this.eligibleLPs.length; i++) {
      const pool: StakedPool = this.poolsToMigrate[this.eligibleLPs[i]];
      const holderAcc = this.holders[pool.lp];
      if (!holderAcc) throw Error(`Couldnt find holder for lp: ${pool.lp}`);
      // Impersonate and give ETH to holder of this coin
      console.log("Staking into pool: ", pool.lp, "for user: ", holderAcc.address);
      this.holders[pool.lp].signer = await impersonateWithEth(holderAcc.address, WeiPerEther.mul(1));
      const holder = this.holders[pool.lp].signer;
      const erc20 = toErc20(pool.lp, holder);
      const stakedBefore = await this.liquidityMigration.staked(holder.address, pool.lp);
      const holderBalance = await erc20.balanceOf(holder.address);
      if (holderBalance.eq(BigNumber.from(0))) {
        throw Error("Need to update holder token balances at scripts/getHoldersWithBalance.ts " + pool.lp);
      }
      // Make sure whitelisted
      expect(await pool.adapter.isWhitelisted(pool.lp)).to.be.eq(true, "Pool not whitelisted");
      // Stake
      await erc20.connect(holder).approve(this.liquidityMigration.address, holderBalance);
      const tx = await this.liquidityMigration.connect(holder).stake(pool.lp, holderBalance, pool.adapter.address);
      expect(await this.liquidityMigration.staked(holder.address, pool.lp)).to.be.eq(holderBalance.add(stakedBefore));
      expect(await erc20.balanceOf(holder.address)).to.be.eq(BigNumber.from(0));
    }
  });
  */

  it("Migrate all pools", async function () {
    await increaseTime(1e15);
    for (let i = 0; i < this.eligibleLPs.length; i++) {
      const pool: StakedPool = this.poolsToMigrate[this.eligibleLPs[i]];
      let poolToken;
      try {
        const bPoolFactory = IPV2SmartPool__factory.connect(pool.lp, this.signers.lmOwner);
        const bPool = await bPoolFactory.getBPool();
        console.log("\n BPOOL: ", bPool);
        poolToken = bPool;
      } catch {
        poolToken = pool.lp;
      }
      const underlyingTokens = await pool.adapter.outputTokens(pool.lp);
      try {
        console.log("\n\nPool ===========> ", pool.lp);
        console.log("Underlying: ", underlyingTokens);
        // deploy strategy
        const strategy = await deployStakedStrategy(this.enso, poolToken, pool.adapter.address, this.signers.lmOwner);
        //console.log("Strategy address: ", strategy.address);

        // TODO: initialize strategy?
        //await this.migrationController.connect(this.signers.lmOwner).setupStrategy(this.signers.lmOwner.address, strategy.address, INITIAL_STATE, ethers.constants.AddressZero, "0x")
        //console.log("Set strategy in migration controller contract")

        // set strategy
        await this.liquidityMigration.connect(this.signers.lmOwner).setStrategy(pool.lp, strategy.address);
        // migrate all
        const tx = await this.liquidityMigration
          .connect(this.signers.lmOwner)
          .migrateAll(pool.lp, pool.adapter.address);

        const receipt = await tx.wait();
        const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, strategy.address, underlyingTokens);
        expect(total).to.be.gt(BigNumber.from(0));
        console.log("strategy items: ", await strategy.items());
        console.log("strategy synths: ", await strategy.synths());
        console.log(`Gas used migrateAll for ${pool.lp} : ${receipt.gasUsed.toString()}`);

        //expect(await strategy.balanceOf(pool.users[0])).to.be.gt(0);
      } catch (err) {
        console.log(err);
        //console.log("Pool not found!")
        continue;
      }
    }
  });
});
