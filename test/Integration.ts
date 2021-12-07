import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Signer, Contract, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IAdapter, IERC20__factory, IStrategy__factory } from "../typechain";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { PieDaoEnvironmentBuilder } from "../src/piedao";
import { IndexedEnvironmentBuilder } from "../src/indexed";
import { PowerpoolEnvironmentBuilder } from "../src/powerpool";
import { DHedgeEnvironmentBuilder } from "../src/dhedge";
import { setupStrategyItems, encodeStrategyData } from "../src/utils";
import { EnsoBuilder, ITEM_CATEGORY, ESTIMATOR_CATEGORY, Tokens, EnsoEnvironment } from "@enso/contracts";
import { WETH, SUSD, INITIAL_STATE } from "../src/constants";
import { LP_TOKEN_WHALES } from "../tasks/initMasterUser";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Integration: Unit tests", function () {
  const poolsToMigrate: any[] = [];
  let dhedgeAdapter: Contract;
  let indexedAdapter: Contract;
  let pieDaoAdapter: Contract;
  let powerpoolAdapter: Contract;
  let tokensetsAdapter: Contract;
  let indexCoopAdapter: Contract;

  const toErc20 = (addr: string, signer: Signer) => {
    return IERC20__factory.connect(addr, signer);
  };

  const setupPools = async (signer: SignerWithAddress, enso: EnsoEnvironment) => {
    const liquidityMigrationBuilder = new LiquidityMigrationBuilder(signer, enso);
    let pool;
    for (const { victim, lpTokenAddress, lpTokenName, walletAddress } of LP_TOKEN_WHALES) {
      switch (victim.toLowerCase()) {
        case "dhedge":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new DHedgeEnvironmentBuilder(signer, dhedgeAdapter).connect(lpTokenAddress, [walletAddress]);
          if (!dhedgeAdapter) {
            dhedgeAdapter = pool.adapter;
            liquidityMigrationBuilder.addAdapter(AcceptedProtocols.DHedge, pool.adapter as IAdapter);
          }
          poolsToMigrate.push(pool);
          break;

        case "indexed":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new IndexedEnvironmentBuilder(signer, indexedAdapter).connect(lpTokenAddress, [walletAddress]);
          if (!indexedAdapter) {
            indexedAdapter = pool.adapter;
            liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Indexed, pool.adapter as IAdapter);
          }
          poolsToMigrate.push(pool);
          break;

        case "piedao":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new PieDaoEnvironmentBuilder(signer, pieDaoAdapter).connect(lpTokenAddress, [walletAddress]);
          if (!pieDaoAdapter) {
            pieDaoAdapter = pool.adapter;
            liquidityMigrationBuilder.addAdapter(AcceptedProtocols.PieDao, pool.adapter as IAdapter);
          }
          poolsToMigrate.push(pool);
          break;

        case "powerpool":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new PowerpoolEnvironmentBuilder(signer, powerpoolAdapter).connect(lpTokenAddress, [
            walletAddress,
          ]);
          if (!powerpoolAdapter) {
            powerpoolAdapter = pool.adapter;
            liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Powerpool, pool.adapter as IAdapter);
          }
          poolsToMigrate.push(pool);
          break;

        case "tokensets":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new TokenSetEnvironmentBuilder(signer, enso, tokensetsAdapter).connect(lpTokenAddress, [
            walletAddress,
          ]);
          if (!tokensetsAdapter) {
            tokensetsAdapter = pool.adapter;
            liquidityMigrationBuilder.addAdapter(AcceptedProtocols.TokenSets, pool.adapter as IAdapter);
          }
          poolsToMigrate.push(pool);
          break;

        case "indexcoop":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new TokenSetEnvironmentBuilder(signer, enso, indexCoopAdapter).connect(lpTokenAddress, [
            walletAddress,
          ]);
          if (!indexCoopAdapter) {
            indexCoopAdapter = pool.adapter;
            liquidityMigrationBuilder.addAdapter(AcceptedProtocols.IndexCoop, pool.adapter as IAdapter);
          }
          poolsToMigrate.push(pool);
          break;

        default:
          throw Error("Failed to parse victim");
      }
    }
    // deploy liqudity migration
    const lm = await liquidityMigrationBuilder.deploy();

    // add pools to adapters
    const txs = await Promise.all(poolsToMigrate.map(async p => await p.adapter.add(p.pool.address)));

    await Promise.all(txs.map(async p => await p.wait()));

    return lm.liquidityMigration;
  };

  before(async function () {
    this.signers = {} as Signers;
    const signers = await ethers.getSigners();
    this.signers.default = signers[0];
    this.signers.admin = signers[10];
    this.enso = await new EnsoBuilder(this.signers.admin).mainnet().build();
    this.tokens = new Tokens();
    this.tokens.registerTokens(this.signers.admin, this.enso.platform.strategyFactory);

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
    await this.enso.platform.strategyFactory
      .connect(this.signers.admin)
      .addItemToRegistry(
        ITEM_CATEGORY.BASIC,
        ESTIMATOR_CATEGORY.CHAINLINK_ORACLE,
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202",
      ); //Synth estimator uses Chainlink, but otherwise will be treated like a basic token

    this.liquidityMigration = await setupPools(this.signers.default, this.enso);
  });

  it("Stake all tokens", async function () {
    for (let i = 0; i < poolsToMigrate.length; i++) {
      const pool = poolsToMigrate[i];
      const erc20 = toErc20(pool.pool.address, this.signers.default);
      const holder2 = await pool.holders[0];
      const holder2Address = await holder2.getAddress();
      const holder2Balance = await erc20.balanceOf(holder2Address);

      if (holder2Balance == BigNumber.from(0)) {
        console.log("Balance: ", holder2Balance, "  \nHolder: ", holder2Address);
      }
      expect(await pool.adapter.isWhitelisted(pool.pool.address)).to.be.eq(true, "Pool not whitelisted");
      // expect(holder2Balance).to.be.gt(BigNumber.from(0));

      await erc20.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
      await this.liquidityMigration
        .connect(holder2)
        .stake(pool.pool.address, holder2Balance.div(2), pool.adapter.address);
      expect(await this.liquidityMigration.staked(holder2Address, pool.pool.address)).to.equal(holder2Balance.div(2));
      const holder2AfterBalance = await erc20.balanceOf(holder2Address);

      if (holder2Balance == BigNumber.from(0)){
         console.log("Balance: ", holder2Balance, " \nHolder: ", holder2Address);
      }
      // expect(holder2AfterBalance).to.be.gt(BigNumber.from(0));
    }
  });

  it("Migrate tokens", async function () {
    for (let i = 0; i < poolsToMigrate.length; i++) {
      const pool = poolsToMigrate[i];
      const underlyingTokens = await pool.adapter.outputTokens(pool.pool.address);
      // // encode strategy items
      // console.log("Pool: ", pool.pool.address);
      // console.log(" \nUnderlying tokens: \n", underlyingTokens);
      // TODO: figure out adapter?
      // const strategyItems = await setupStrategyItems(
      //   this.enso.platform.oracles.ensoOracle,
      //   this.enso.adapters.uniswap.contract.address,
      //   pool.pool.address,
      //   underlyingTokens,
      // );
      // // deploy strategy
      // const strategyData = encodeStrategyData(
      //   this.signers.default.address,
      //   `Token - ${i}`,
      //   `Address: ${pool.pool.address}`,
      //   strategyItems,
      //   INITIAL_STATE,
      //   ethers.constants.AddressZero,
      //   "0x",
      // );
      //console.log("Creating strategy: \n", strategyItems);
      // const tx = await this.liquidityMigration.createStrategy(
      //   pool.pool.address,
      //   pool.adapter.address,
      //   strategyData,
      // );
      // const receipt = await tx.wait();
      // const strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
      // //console.log("Strategy address: ", strategyAddress);
      // this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);
    }
  });
});
