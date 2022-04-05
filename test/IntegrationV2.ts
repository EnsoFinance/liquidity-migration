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
import { setupStrategyItems, encodeStrategyData, estimateTokens, increaseTime } from "../src/utils";
import { EnsoBuilder, ITEM_CATEGORY, ESTIMATOR_CATEGORY, Tokens, EnsoEnvironment } from "@enso/contracts";
import { WETH, SUSD, INITIAL_STATE, DEPOSIT_SLIPPAGE } from "../src/constants";
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
    const factory = this.enso.platform.strategyFactory;
    const { chainlinkRegistry, curveDepositZapRegistry } = this.enso.platform.oracles.registries;
    this.tokens = new Tokens();
    this.tokens.registerTokens(
      this.signers.admin,
      this.enso.platform.strategyFactory,
      curveDepositZapRegistry,
      chainlinkRegistry,
    );
    this.liquidityMigration = await setupPools(this.signers.default, this.enso);

    // Register tokens
    // Compound
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.COMPOUND,
      "0x70e36f6BF80a52b3B46b3aF8e106CC0ed743E8e4",
    ); //cCOMP
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.COMPOUND,
      "0x35A18000230DA775CAc24873d00Ff85BccdeD550",
    ); //cUNI
    // Curve
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.CURVE,
      "0x4f3E8F405CF5aFC05D68142F3783bDfE13811522",
    ); //usdn3CRV
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.CURVE,
      "0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a",
    ); //BUSD3CRV-f
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.CURVE,
      "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA",
    ); //LUSD3CRV-f
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.CURVE,
      "0x7Eb40E450b9655f4B3cC4259BCC731c63ff55ae6",
    ); //USDP/3Crv
    // YEarn
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.YEARN_V2,
      "0x3B96d491f067912D18563d56858Ba7d6EC67a6fa",
    ); //yvCurve-USDN
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.YEARN_V2,
      "0x6ede7f19df5df6ef23bd5b9cedb651580bdf56ca",
    ); //yvCurve-BUSD
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.YEARN_V2,
      "0x5fA5B62c8AF877CB37031e0a3B2f34A78e3C56A6",
    ); //yvCurve-LUSD
    await factory.addItemToRegistry(
      ITEM_CATEGORY.BASIC,
      ESTIMATOR_CATEGORY.YEARN_V2,
      "0xC4dAf3b5e2A9e93861c3FBDd25f1e943B8D87417",
    ); //yvCurve-USDP
  });

  it("Stake all tokens", async function () {
    for (let i = 0; i < poolsToMigrate.length; i++) {
      const pool = poolsToMigrate[i];
      const erc20 = toErc20(pool.pool.address, this.signers.default);
      const holder = await pool.holders[0];
      const holderAddress = await holder.getAddress();
      const holderBalance = await erc20.balanceOf(holderAddress);

      if (holderBalance.eq(BigNumber.from(0))) {
        console.log("Balance: ", holderBalance, "  \nHolder: ", holderAddress);
        throw Error("Need to update holder for pool in tasks/initMasterUser: " + pool.address);
      }
      expect(await pool.adapter.isWhitelisted(pool.pool.address)).to.be.eq(true, "Pool not whitelisted");
      // expect(holderBalance).to.be.gt(BigNumber.from(0));

      await erc20.connect(holder).approve(this.liquidityMigration.address, holderBalance.div(2));
      await this.liquidityMigration
        .connect(holder)
        .stake(pool.pool.address, holderBalance.div(2), pool.adapter.address);
      expect(await this.liquidityMigration.staked(holderAddress, pool.pool.address)).to.equal(holderBalance.div(2));
    }
  });

  it("Migrate tokens", async function () {
    await increaseTime(10);
    for (let i = 0; i < poolsToMigrate.length; i++) {
      const pool = poolsToMigrate[i];
      if (
        // Skip 2X FLI, SciFi (GEL), WEB3 (OHM)
        pool.pool.address !== "0xaa6e8127831c9de45ae56bb1b0d4d4da6e5665bd" &&
        pool.pool.address !== "0x0b498ff89709d3838a063f1dfa463091f9801c2b" &&
        pool.pool.address !== "0xfdc4a3fc36df16a78edcaf1b837d3acaaedb2cb4" &&
        pool.pool.address !== "0xe8e8486228753E01Dbc222dA262Aa706Bd67e601"
      ) {
        const underlyingTokens = await pool.adapter.outputTokens(pool.pool.address);
        // encode strategy items
        console.log("Pool: ", pool.pool.address);
        //console.log("Underlying tokens: \n", underlyingTokens);
        let poolAddress;
        try {
          // Some PieDao pool hold their tokens in Balancer pools
          poolAddress = await pool.pool.getBPool();
        } catch (e) {
          poolAddress = pool.pool.address;
        }
        const strategyItems = await setupStrategyItems(
          this.enso.platform.oracles.ensoOracle,
          ethers.constants.AddressZero, // For real strategies an adapter is needed, but for migration it is not
          poolAddress,
          underlyingTokens,
        );
        // deploy strategy
        const strategyData = encodeStrategyData(
          this.signers.default.address,
          `Token - ${i}`,
          `Address: ${pool.pool.address}`,
          strategyItems,
          INITIAL_STATE,
          ethers.constants.AddressZero,
          "0x",
        );
        //console.log("Creating strategy: \n", strategyItems);
        const tx = await this.liquidityMigration.createStrategy(pool.pool.address, pool.adapter.address, strategyData);
        const receipt = await tx.wait();
        const strategyAddress = receipt.events.find((ev: Event) => ev.event === "Created").args.strategy;
        this.strategy = IStrategy__factory.connect(strategyAddress, this.signers.default);

        // Migrate
        const holder = await pool.holders[0];
        const holderAddress = await holder.getAddress();
        console.log("Holder address: ", holderAddress);
        await this.liquidityMigration
          .connect(holder)
          ["migrate(address,address,address,uint256)"](
            pool.pool.address,
            pool.adapter.address,
            this.strategy.address,
            DEPOSIT_SLIPPAGE,
          );
        const [total] = await estimateTokens(
          this.enso.platform.oracles.ensoOracle,
          this.strategy.address,
          underlyingTokens,
        );
        expect(total).to.gt(0);
        expect(await this.strategy.balanceOf(holderAddress)).to.gt(0);
        console.log("strategy items: ", await this.strategy.items());
        console.log("strategy synths: ", await this.strategy.synths());
      }
    }
  });
});
