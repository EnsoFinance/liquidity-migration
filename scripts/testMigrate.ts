import hre from "hardhat";
import { BigNumber } from "ethers";
import { DeployedContracts } from "../src/types";
import { ENSO_CONTRACTS_MULTISIG, ENSO_TREASURY_MULTISIG } from "../src/constants";
import { impersonateAccount, liveMigrationContract, getPoolsToMigrate } from "../src/mainnet";
import { getLiveContracts } from "@ensofinance/v1-core";
import deployedStrategies from "../out/deployed_strategies.json";
import deployments from "../deployments.json";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const enso = getLiveContracts(signer);

  //Impersonate Treasury Multisig
  const treasury = await impersonateAccount(ENSO_TREASURY_MULTISIG);
  const liquidityMigration = await liveMigrationContract(treasury);

  //Set Strategies in LiquidityMigrationV2
  const strategies: DeployedContracts = deployedStrategies;
  const lps = Object.keys(strategies);
  for (let i = 0; i < lps.length; i++) {
    const lp = lps[i];
    try {
      console.log("Setting strategy: ", lp, strategies[lp]);
      await liquidityMigration.setStrategy(lp, strategies[lp]);
    } catch (e) {
      console.log(e);
    }
  }

  //Migrate Strategies
  const stakedPools = await getPoolsToMigrate(signer);
  for (let i = 0; i < lps.length; i++) {
    const lp = lps[i];
    const pool = stakedPools[lp];
    if (pool) {
      try {
        console.log("Migrating: ", lp, pool.adapter.address);
        await liquidityMigration.migrateAll(lp, pool.adapter.address);
      } catch (e) {
        console.log(e);
      }
    }
  }

  //Impersonate Upgrade Multisig
  const upgrades = await impersonateAccount(ENSO_CONTRACTS_MULTISIG);

  //Update StrategyController implementation
  await enso.platform.administration.platformProxyAdmin
    .connect(upgrades)
    .upgrade(enso.platform.controller.address, "0x43DaCf2d9E6fb37449Bb962986219aE787d80cc3");

  //Test Strategies
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
