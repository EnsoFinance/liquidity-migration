import hre from "hardhat";
import { BigNumber } from "ethers";
import { EthersUnsigned, encodeMulticall, validateAndEncode } from "../../scripts/common";
import { DeployedContracts } from "../../src/types";
import { write2File } from "../../src/utils";
import { ENSO_CONTRACTS_MULTISIG, ENSO_TREASURY_MULTISIG } from "../../src/constants";
import { impersonateAccount, liveMigrationContract, getPoolsToMigrate } from "../../src/mainnet";
import { getLiveContracts } from "@ensofinance/v1-core";
import deployedStrategies from "../../out/deployed_strategies.json";
import lpsMigrated from "../../out/migrated_lps.json";
import strategiesSet from "../../out/strategies_set.json";
import EthersAdapter from "@gnosis.pm/safe-ethers-lib";
import Safe from "@gnosis.pm/safe-core-sdk";
import SafeServiceClient from "@gnosis.pm/safe-service-client";
import { MetaTransactionData } from "@gnosis.pm/safe-core-sdk-types";

const MAX_MIGRATION_BATCH = 3;

async function main() {
  const senderAddress = "0x05d0cf613e9a140fAbdb33Fd7e8d8009F6Df8B3d";
  if (!senderAddress) throw Error("Must set multisig signer address");
  const sender = await impersonateAccount(senderAddress);
  const treasury = await impersonateAccount(ENSO_TREASURY_MULTISIG);
  const enso = getLiveContracts(treasury);

  const liquidityMigration = await liveMigrationContract(treasury);

  //Gnosis safe
  const safeAddress = ENSO_TREASURY_MULTISIG;
  const ethAdapter = new EthersAdapter({ ethers: hre.ethers, signer: treasury });
  const safeSdk = await Safe.create({ ethAdapter, safeAddress });
  const safeService = new SafeServiceClient({
    txServiceUrl: "https://safe-transaction.gnosis.io",
    ethAdapter,
  });

  //Get migrated lps
  const lpsAlreadyMigrated: DeployedContracts = lpsMigrated;
  const transactions: MetaTransactionData[] = [];

  // Encode calls to setStrategies for each lp
  const strategies: DeployedContracts = deployedStrategies;
  const lps = Object.keys(strategies);

  /*
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
    .upgrade(enso.platform.controller.address, "0xEfbF7555cD248571b88562070d06E0Da25Fc2034");

  //Test Strategies
  */
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
