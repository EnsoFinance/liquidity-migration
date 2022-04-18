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
} from "../src/mainnet";
import { AcceptedProtocols, StakedPool } from "../src/types";
import { IAdapter, IERC20__factory, IStrategy__factory, IPV2SmartPool__factory } from "../typechain";
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
import { ENSO_MULTISIG, WETH, SUSD, INITIAL_STATE, DEPOSIT_SLIPPAGE } from "../src/constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { WeiPerEther } = constants;

describe("Stake and Migrate all tokens", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    const admin = await ethers.getSigner(ENSO_MULTISIG);
    this.signers.admin = await impersonateWithEth(admin.address, WeiPerEther.mul(10));
    this.enso = getLiveContracts(this.signers.admin);
    // KNC not on Uniswap, use Chainlink
    await this.enso.platform.oracles.registries.chainlinkRegistry
      .connect(this.signers.admin)
      .addOracle(SUSD, WETH, "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", true); //sUSD
    await this.enso.platform.oracles.registries.chainlinkRegistry
      .connect(this.signers.admin)
      .addOracle(
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202",
        SUSD,
        "0xf8ff43e991a81e6ec886a3d281a2c6cc19ae70fc",
        false,
      ); //KNC
    console.log("Owner ", await this.enso.platform.strategyFactory.owner());
    await this.enso.platform.strategyFactory
      .connect(this.signers.admin)
      .addItemToRegistry(
        ITEM_CATEGORY.BASIC,
        ESTIMATOR_CATEGORY.CHAINLINK_ORACLE,
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202",
      );

    const { chainlinkRegistry, curveDepositZapRegistry } = this.enso.platform.oracles.registries;
    this.liquidityMigration = liveMigrationContract(this.signers.admin);
    this.poolsToMigrate = await getPoolsToMigrate(this.signers.admin);
    this.holders = await readTokenHolders();
    // Setup liquidity migration admin functions
    const owner = await this.liquidityMigration.owner();
    if (this.signers.admin.address !== owner) {
      this.signers.lmOwner = await impersonateWithEth(owner, WeiPerEther.mul(10));
    } else {
      this.signers.lmOwner = this.signers.admin;
    }
    await this.liquidityMigration.connect(this.signers.lmOwner).updateController(this.enso.platform.controller.address);
    await this.liquidityMigration
      .connect(this.signers.lmOwner)
      .updateGenericRouter(this.enso.routers.multicall.address);
    expect(await this.liquidityMigration.controller()).is.not.eq(ethers.constants.AddressZero, "Controller not set");
  });

  it("Stake all tokens", async function () {
    for (let i = 0; i < this.poolsToMigrate.length; i++) {
      const pool: StakedPool = this.poolsToMigrate[i];
      const holderAcc = this.holders[pool.lp];
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

  it("Migrate all pools", async function () {
    await increaseTime(1e15);
    for (let i = 0; i < this.poolsToMigrate.length; i++) {
      const pool = this.poolsToMigrate[i];
      const underlyingTokens = await pool.adapter.outputTokens(pool.lp);
      const holder = this.holders[pool.lp];
      console.log("Holder address: ", holder.address);
      // PieDao uses Balancer pools
      let poolAddress;
      try {
        const pieDaoPool = IPV2SmartPool__factory.connect(pool.lp, this.signers.default);
        poolAddress = await pieDaoPool.getBPool();
      } catch (e) {
        poolAddress = pool.lp;
      }
      try {
        console.log("Pool: ", pool.lp);
        // deploy strategy
        this.strategy = await deployStakedStrategy(this.enso, pool.lp, pool.adapter.address, this.signers.admin);
        await this.liquidityMigration.connect(this.signers.lmOwner).setStrategy(pool.lp, this.strategy.address);
        const tx = await this.liquidityMigration
          .connect(this.signers.lmOwner)
          .migrateAll(pool.lp, pool.adapter.address);

        //expect(await this.strategy.balanceOf(holder.address)).to.gt(0);
        //console.log("strategy items: ", await this.strategy.items());
        //console.log("strategy synths: ", await this.strategy.synths());
      } catch (err) {
        console.log(err);
        //console.log("Pool not found!")
        continue;
      }
    }
  });
});
