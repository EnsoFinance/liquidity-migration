import { ethers, network } from "hardhat";
import { expect } from "chai";
import { BigNumber, Event } from "ethers";
import { Signers } from "../types";
import { AcceptedProtocols, LiquidityMigrationBuilder } from "../src/liquiditymigration";
import { IERC20__factory } from "../typechain";
import Strategy from "@ensofinance/v1-core/artifacts/contracts/Strategy.sol/Strategy.json";
import { TokenSetEnvironmentBuilder } from "../src/tokenSets";
import { INITIAL_STATE } from "../src/constants";
import { EnsoBuilder, InitialState, StrategyItem, ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "@ensofinance/v1-core";
import { WETH, SUSD } from "../src/constants";
import { setupStrategyItems, getBlockTime } from "../src/utils";
import deployments from "../deployments.json";

const migrator = "0x007A8CFf81A9FCca63E8a05Acb41A8292F4b353e";

describe("MigrationCoordinator tests: ", function () {
  let signers: any, liquidityMigration: any, liquidityMigrationV2: any, migrationCoordinator: any, users: any;

  before(async function () {
    signers = {} as Signers;
    const allSigners = await ethers.getSigners();
    signers.default = allSigners[0];
    signers.secondary = allSigners[1];

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [migrator],
    });
    signers.admin = await ethers.getSigner(migrator);

    const LiquidityMigration = await ethers.getContractFactory("LiquidityMigration");
    liquidityMigration = LiquidityMigration.attach(deployments.mainnet.LiquidityMigration);
  });

  it("Should deploy new liquidity migration contract", async function () {
    const LiquidityMigrationV2 = await ethers.getContractFactory("LiquidityMigrationV2");
    liquidityMigrationV2 = await LiquidityMigrationV2.connect(signers.admin).attach(
      deployments.mainnet.LiquidityMigrationV2,
    );
  });

  it("Should setup migration coordinator", async function () {
    // Deploy contract
    const MigrationCoordinator = await ethers.getContractFactory("MigrationCoordinator");
    migrationCoordinator = await MigrationCoordinator.connect(signers.admin).attach(
      deployments.mainnet.MigrationCoordinator,
    );
  });

  it("Should migrate to new LiquidityMigration contract", async function () {
    const eventFilter = liquidityMigration.filters.Staked(null, null, null, null);
    const events = await liquidityMigration.queryFilter(eventFilter);
    console.log("Staked events: ", events.length);

    let stakedAdapters = events.map((ev: Event) => ev?.args?.adapter);
    stakedAdapters = stakedAdapters.filter(
      (adapter: string, index: number) => stakedAdapters.indexOf(adapter) === index,
    );

    let txCount = 0;
    let gasUsed = ethers.BigNumber.from(0);
    for (let i = 0; i < stakedAdapters.length; i++) {
      console.log("Adapter: ", stakedAdapters[i]);
      let stakedLPs = events
        .filter((ev: Event) => ev?.args?.adapter.toLowerCase() === stakedAdapters[i].toLowerCase())
        .map((ev: Event) => ev?.args?.strategy);
      stakedLPs = stakedLPs.filter((lp: string, index: number) => stakedLPs.indexOf(lp) === index);
      console.log("Number of LPs: ", stakedLPs.length);

      for (let j = 0; j < stakedLPs.length; j++) {
        console.log("LP: ", stakedLPs[j]);
        let stakers = events
          .filter((ev: Event) => ev?.args?.strategy.toLowerCase() === stakedLPs[j].toLowerCase())
          .filter((ev: Event) => ev?.args?.amount.gt(0))
          .map((ev: Event) => ev?.args?.account);
        stakers = stakers.filter((account: string, index: number) => stakers.indexOf(account) === index);

        let remainder = stakers.length;
        while (remainder > 0) {
          let users;
          if (remainder > 150) {
            users = stakers.slice(0, 150);
          } else {
            users = stakers;
          }
          console.log("Users migrating: ", users.length);
          const tx = await migrationCoordinator
            .connect(signers.admin)
            .migrateLP(users, stakedLPs[j], stakedAdapters[i]);
          const receipt = await tx.wait();
          gasUsed = gasUsed.add(receipt.gasUsed);
          console.log("Migrate LP Gas Used: ", receipt.gasUsed.toString());
          txCount++;
          stakers = stakers.slice(users.length, remainder);
          remainder = remainder - users.length;
        }
      }
    }
    console.log("Total transactions: ", txCount);
    console.log("Total gas used: ", gasUsed.toString());
  });
});
