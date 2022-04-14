import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Signer, Contract, Event } from "ethers";
import { Signers } from "../types";
import { getPoolsToMigrate, liveMigrationContract } from "../src/mainnet";
import { AcceptedProtocols } from "../src/types";
import { IAdapter, IERC20__factory, IStrategy__factory, IPV2SmartPool__factory } from "../typechain";
import { toErc20, setupStrategyItems, encodeStrategyData, estimateTokens, increaseTime } from "../src/utils";
import { getLiveContracts, ITEM_CATEGORY, ESTIMATOR_CATEGORY, Tokens, EnsoEnvironment } from "@ensofinance/v1-core";
import { ENSO_MULTISIG, WETH, SUSD, INITIAL_STATE, DEPOSIT_SLIPPAGE } from "../src/constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Integration: Unit tests", function () {
  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = await ethers.getSigner(ENSO_MULTISIG);
    this.enso = getLiveContracts(this.signers.admin);
    const { chainlinkRegistry, curveDepositZapRegistry } = this.enso.platform.oracles.registries;
    this.liquidityMigration = liveMigrationContract(this.signers.admin);
    this.poolsToMigrate = await getPoolsToMigrate(this.signers.admin);
  });

  it("Stake all tokens", async function () {
    for (let i = 0; i < this.poolsToMigrate.length; i++) {
      const pool = this.poolsToMigrate[i];
      const holder = await ethers.getSigner(pool.holder[0]);
      const erc20 = toErc20(pool.lp, this.signers.admin);
      const holderBalance = pool.balances[holder.address];
      //const holderBalance = await erc20.balanceOf(holder);

      if (holderBalance.eq(BigNumber.from(0))) {
        console.log("Balance: ", holderBalance, "  \nHolder: ", holder.address);
        throw Error("Need to update holder for pool in tasks/initMasterUser: " + pool.lp);
      }

      // TODO: adapter getter
      //expect(await pool.adapter.isWhitelisted(pool.pool.address)).to.be.eq(true, "Pool not whitelisted");
      // expect(holderBalance).to.be.gt(BigNumber.from(0));

      await erc20.connect(holder).approve(this.liquidityMigration.address, holderBalance.div(2));
      await this.liquidityMigration.connect(holder).stake(pool.lp, holderBalance.div(2), pool.adapter);
      expect(await this.liquidityMigration.staked(holder.address, pool.lp)).to.equal(holderBalance.div(2));
    }
  });

  it("Migrate tokens", async function () {
    await increaseTime(10);
    for (let i = 0; i < this.poolsToMigrate.length; i++) {
      const pool = this.poolsToMigrate[i];
      if (
        // Skip 2X FLI, SciFi (GEL), WEB3 (OHM)
        pool.lp !== "0xaa6e8127831c9de45ae56bb1b0d4d4da6e5665bd" &&
        pool.lp !== "0x0b498ff89709d3838a063f1dfa463091f9801c2b" &&
        pool.lp !== "0xfdc4a3fc36df16a78edcaf1b837d3acaaedb2cb4" &&
        pool.lp !== "0xe8e8486228753E01Dbc222dA262Aa706Bd67e601"
      ) {
        const underlyingTokens = await pool.adapter.outputTokens(pool.lp);
        // encode strategy items
        console.log("Pool: ", pool.lp);
        //console.log("Underlying tokens: \n", underlyingTokens);
        let poolAddress;
        try {
          const pieDaoPool = IPV2SmartPool__factory.connect(pool.lp, this.signers.default);
          poolAddress = await pieDaoPool.getBPool();
        } catch (e) {
          poolAddress = pool.lp;
        }
        console.log("Pool address: ", poolAddress);
        const strategyItems = await setupStrategyItems(
          this.enso.platform.oracles.ensoOracle,
          ethers.constants.AddressZero, // For real strategies an adapter is needed, but for migration it is not
          poolAddress,
          underlyingTokens,
        );
        // deploy strategy
        const strategyData = encodeStrategyData(
          this.signers.admin.address,
          `Token - ${i}`,
          `Address: ${pool.lp}`,
          strategyItems,
          INITIAL_STATE,
          ethers.constants.AddressZero,
          "0x",
        );
        //console.log("Creating strategy: \n", strategyItems);
        const tx = await this.liquidityMigration.createStrategy(pool.lp, pool.adapter, strategyData);
        const receipt = await tx.wait();
        const strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
        this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.admin);

        // Migrate
        const holder = await ethers.getSigner(pool.users[0]);
        console.log("Holder address: ", holder.address);
        await this.liquidityMigration
          .connect(holder)
          ["migrate(address,address,address,uint256)"](pool.lp, pool.adapter, this.strategy.address, DEPOSIT_SLIPPAGE);
        const [total] = await estimateTokens(
          this.enso.platform.oracles.ensoOracle,
          this.strategy.address,
          underlyingTokens,
        );
        expect(total).to.gt(0);
        expect(await this.strategy.balanceOf(holder.address)).to.gt(0);
        console.log("strategy items: ", await this.strategy.items());
        console.log("strategy synths: ", await this.strategy.synths());
      }
    }
  });
});
