import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IAdapter, IERC20__factory } from "../typechain";
import { TokenSetEnvironmentBuilder, TokenSetEnvironment } from "../src/tokenSets";
import { PieDaoEnvironment, PieDaoEnvironmentBuilder } from "../src/piedao";
import { IndexedEnvironment, IndexedEnvironmentBuilder } from "../src/indexed";
import { PowerpoolEnvironment, PowerpoolEnvironmentBuilder } from "../src/powerpool";
import { DHedgeEnvironment, DHedgeEnvironmentBuilder } from "../src/dhedge";
import { EnsoBuilder, ITEM_CATEGORY, ESTIMATOR_CATEGORY, Tokens, EnsoEnvironment } from "@enso/contracts";
import { WETH, SUSD } from "../src/constants";
import { LP_TOKEN_WHALES } from "../tasks/initMasterUser";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Integration: Unit tests", function () {
  const indexedPools: IndexedEnvironment[] = [];
  const tokenSetsPools: TokenSetEnvironment[] = [];
  const dhedgePools: DHedgeEnvironment[] = [];
  const pieDaoPools: PieDaoEnvironment[] = [];
  const powerpoolPools: PowerpoolEnvironment[] = [];
  const indexCoopPools: TokenSetEnvironment[] = [];
  const poolsToMigrate: any[] = [];

  const toErc20 =  (addr: string, signer: Signer) => {
    return IERC20__factory.connect(addr, signer);
  }

  const setupPools = async (signer: SignerWithAddress, enso: EnsoEnvironment) => {
    const liquidityMigrationBuilder = new LiquidityMigrationBuilder(signer, enso);
    let pool;
    for (const { victim, lpTokenAddress, lpTokenName, walletAddress } of LP_TOKEN_WHALES) {
      switch (victim.toLowerCase()) {
        case "dhedge":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new DHedgeEnvironmentBuilder(signer).connect(lpTokenAddress, [walletAddress]);
          dhedgePools.push(pool);
          poolsToMigrate.push(pool);
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.DHedge, pool.adapter as IAdapter);
          await pool.adapter.add(lpTokenAddress);
          break;

        case "indexed":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new IndexedEnvironmentBuilder(signer).connect(lpTokenAddress, [walletAddress]);
          indexedPools.push(pool);
          poolsToMigrate.push(pool);
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Indexed, pool.adapter as IAdapter);
          await pool.adapter.add(lpTokenAddress);
          break;

        case "piedao":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new PieDaoEnvironmentBuilder(signer).connect();
          pieDaoPools.push(pool);
          poolsToMigrate.push(pool);
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.PieDao, pool.adapter as IAdapter);
          await pool.adapter.add(lpTokenAddress);
          break;

        case "powerpool":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new PowerpoolEnvironmentBuilder(signer).connect(lpTokenAddress, [walletAddress]);
          powerpoolPools.push(pool);
          poolsToMigrate.push(pool);
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.Powerpool, pool.adapter as IAdapter);
          await pool.adapter.add(lpTokenAddress);
          break;

        case "tokensets":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new TokenSetEnvironmentBuilder(signer, enso).connect(lpTokenAddress, [walletAddress]);
          tokenSetsPools.push(pool);
          poolsToMigrate.push(pool);
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.TokenSets, pool.adapter as IAdapter);
          await pool.adapter.add(lpTokenAddress);
          break;

        case "indexcoop":
          console.log(victim, " ", lpTokenName, " at: ", lpTokenAddress);
          pool = await new TokenSetEnvironmentBuilder(signer, enso).connect(lpTokenAddress, [walletAddress]);
          indexCoopPools.push(pool);
          poolsToMigrate.push(pool);
          liquidityMigrationBuilder.addAdapter(AcceptedProtocols.IndexCoop, pool.adapter as IAdapter);
          await pool.adapter.add(lpTokenAddress);
          break;

        default:
          throw Error("Failed to parse victim");
      }
    }

    return await liquidityMigrationBuilder.deploy();
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
    await this.enso.platform.oracles.protocols.chainlinkOracle
      .connect(this.signers.admin)
      .addOracle(SUSD, WETH, "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", true); //sUSD
    await this.enso.platform.oracles.protocols.chainlinkOracle
      .connect(this.signers.admin)
      .addOracle(
        "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202",
        SUSD,
        "0xf8ff43e991a81e6ec886a3d281a2c6cc19ae70fc",
        false,
      ); //KNC
    await this.enso.platform.strategyFactory
      .connect(this.signers.admin)
      .addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.SYNTH, "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202"); //Synth estimator uses Chainlink, but otherwise will be treated like a basic token

    this.liquidityMigration = await setupPools(this.signers.default, this.enso);
  });

  it("Stake all tokens", async function () {
    for (let i = 0; i < poolsToMigrate.length; i++) {
      console.log("Staking for pool: ", await poolsToMigrate[i].pool.address);
      const erc20 = toErc20(poolsToMigrate[i].pool.address, this.signers.default);
      const holder2 = await poolsToMigrate[i].holders[0];
      const holder2Address = await holder2.getAddress();
      const holder2Balance = await erc20.balanceOf(holder2Address);
      expect(holder2Balance).to.be.gt(BigNumber.from(0), "No balance found for holder: " + holder2Address);
      await erc20.connect(holder2).approve(this.liquidityMigration.address, holder2Balance);
      await this.liquidityMigration
        .connect(holder2)
        .stake(poolsToMigrate[i].pool.address, holder2Balance.div(2), poolsToMigrate[i].adapter.address);
      expect(await this.liquidityMigration.staked(holder2Address, poolsToMigrate[i].pool.address)).to.equal(
        holder2Balance.div(2),
      );
      const holder2AfterBalance = await erc20.balanceOf(holder2Address);
      expect(holder2AfterBalance).to.be.gt(BigNumber.from(0));
    }
  });
});
