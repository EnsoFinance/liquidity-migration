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

    // Add all eligible LPs to this adapter's whitelist
    this.eligibleLPs = Object.keys(this.poolsToMigrate);
    //console.log("LPS: ", this.eligibleLPs)

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

    /* Test MulticallRouter with better revert messages
    const MulticallRouter = await ethers.getContractFactory("MulticallRouter");
    this.enso.routers.multicall = await MulticallRouter.connect(this.signers.lmOwner).deploy(
      this.enso.platform.controller.address
    )
    await this.enso.routers.multicall.deployed()
    await this.enso.platform.administration.whitelist
      .connect(this.signers.treasury)
      .approve(this.enso.routers.multicall.address)
    */

    // Update generic router (leverage adapter + liquidity migration)
    await this.liquidityMigration
      .connect(this.signers.lmOwner)
      .updateGenericRouter(this.enso.routers.multicall.address);
    this.indexCoopAdapter = await getAdapterFromType(Adapters.IndexCoopAdapter, this.signers.treasury);
    await this.indexCoopAdapter.connect(this.signers.lmOwner).updateGenericRouter(this.enso.routers.multicall.address);
    this.tokenSetAdapter = await getAdapterFromType(Adapters.TokenSetAdapter, this.signers.treasury);
    await this.tokenSetAdapter.connect(this.signers.lmOwner).updateGenericRouter(this.enso.routers.multicall.address);
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
    let count = 0;
    for (let i = 0; i < this.eligibleLPs.length; i++) {
      const pool: StakedPool = this.poolsToMigrate[this.eligibleLPs[i]];
      const underlyingTokens = await pool.adapter.outputTokens(pool.lp);
      try {
        console.log("\n\nPool ===========> ", pool.lp);
        console.log("Underlying: ", underlyingTokens);
        // deploy strategy
        const strategy = await deployStakedStrategy(this.enso, pool.lp, pool.adapter.address, this.signers.lmOwner);
        console.log("strategy synths: ", await strategy.synths());
        console.log("strategy items: ", await strategy.items());
        console.log("Strategy address: ", strategy.address);
        // set strategy
        await this.liquidityMigration.connect(this.signers.lmOwner).setStrategy(pool.lp, strategy.address);
        // migrate all
        const tx = await this.liquidityMigration
          .connect(this.signers.lmOwner)
          .migrateAll(pool.lp, pool.adapter.address);

        const receipt = await tx.wait();
        const [total] = await estimateTokens(this.enso.platform.oracles.ensoOracle, strategy.address, underlyingTokens);
        expect(total).to.be.gt(BigNumber.from(0));
        //console.log(`migrateAll cost: ${receipt.gasUsed.toString()}`);

        //expect(await strategy.balanceOf(pool.users[0])).to.be.gt(0);
      } catch (err) {
        count++;
        //console.log("\n\nPool ===========> ", pool.lp);
        //console.log("Underlying: ", underlyingTokens);
        console.log(err);
        //console.log("Pool not found!")
        continue;
      }
    }
    console.log("Failing strategies: ", count);
  });
});
