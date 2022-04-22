import hre from "hardhat";
import { BigNumber } from "ethers";
import { EthersUnsigned, encodeMulticall, validateAndEncode } from "../../scripts/common";
import { DeployedContracts, TransactionBatch } from "../../src/types";
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
  // Impersonate multisig accounts
  const senderAddress = "0x05d0cf613e9a140fAbdb33Fd7e8d8009F6Df8B3d";
  if (!senderAddress) throw Error("Must set multisig signer address");
  const sender = await impersonateAccount(senderAddress);
  const treasury = await impersonateAccount(ENSO_TREASURY_MULTISIG);
  const upgrades = await impersonateAccount(ENSO_CONTRACTS_MULTISIG);

  // Get live migration + v1-core contracts
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
  const lpsToMigrate: DeployedContracts = {};
  const transactions: TransactionBatch[] = [];
  let batchTx: MetaTransactionData[] = [];

  // Get deployed strategies
  const strategies: DeployedContracts = deployedStrategies;
  const lpsDeployed = Object.keys(strategies);

  // Gathered from Staked events
  const stakedPools = await getPoolsToMigrate(treasury);

  // Filter out already migrated
  const migrated = lpsDeployed.filter(lp => lpsAlreadyMigrated[lp]);
  const toBeMigrated = lpsDeployed.filter(lp => !lpsAlreadyMigrated[lp]);

  //console.log("Migrating folliwng lps: ", toBeMigrated)
  console.log(`Already migrated ${migrated.length} / ${lpsDeployed.length} lps`);
  // Encode gnosis txs
  await Promise.all(
    toBeMigrated.map(async (lp: string) => {
      const pool = stakedPools[lp];
      if (pool) {
        try {
          console.log("Encoding migrateAll() tx for : ", lp, pool.adapter.address);
          const tx = await liquidityMigration.populateTransaction.migrateAll(lp, pool.adapter.address);
          lpsToMigrate[lp] = pool.adapter.address;
          if (batchTx.length < MAX_MIGRATION_BATCH) {
            batchTx.push(validateAndEncode(tx));
          } else {
            const filename: string = "batch" + transactions.length;
            console.log("Created batch: ", filename);
            batchTx = [];
            transactions.push({ batchTx, filename });
          }
        } catch (e) {
          console.log(e);
        }
      } else {
        console.log("Couldn't find pool for: ", lp);
      }
    }),
  );

  while (transactions.length > 0) {
    // get first batch
    const txs = transactions.shift();
    if (!txs) throw Error("Unexpected error accessing transactions list!");

    // create gnosis transaction
    const safeTransaction = await safeSdk.createTransaction(txs.batchTx);
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);

    // propose transaction
    await safeService.proposeTransaction({
      safeAddress,
      safeTransaction,
      safeTxHash,
      senderAddress,
    });

    // decode transaction
    const tx = await safeService.getTransaction(safeTxHash);
    if (!tx.dataDecoded) throw Error("Failed to decode transaction");
    const valuesDecoded = JSON.stringify(tx.dataDecoded);

    // save values to json files
    console.log("Saving multisig decoded values to out/migrations/", txs.filename);
    write2File("migrations/" + txs.filename + ".json", tx.dataDecoded);
    console.log("Saving migrated lps to out/migrated_lps.json");
    write2File("migrated_lps.json", lpsToMigrate);
  }

  //Update StrategyController implementation
  /*
  await enso.platform.administration.platformProxyAdmin
    .connect(upgrades)
    .upgrade(enso.platform.controller.address, "0xEfbF7555cD248571b88562070d06E0Da25Fc2034");
  */
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
