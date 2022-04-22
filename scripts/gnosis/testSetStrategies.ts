import hre from "hardhat";
import { validateAndEncode } from "../../scripts/common";
import { DeployedContracts } from "../../src/types";
import { write2File } from "../../src/utils";
import { ENSO_TREASURY_MULTISIG } from "../../src/constants";
import { impersonateAccount, liveMigrationContract, getPoolsToMigrate } from "../../src/mainnet";
import { getLiveContracts } from "@ensofinance/v1-core";
import deployedStrategies from "../../out/deployed_strategies.json";
import strategiesSet from "../../out/strategies_set.json";
import EthersAdapter from "@gnosis.pm/safe-ethers-lib";
import Safe from "@gnosis.pm/safe-core-sdk";
import SafeServiceClient from "@gnosis.pm/safe-service-client";
import { MetaTransactionData } from "@gnosis.pm/safe-core-sdk-types";

async function main() {
  const senderAddress = "0x05d0cf613e9a140fAbdb33Fd7e8d8009F6Df8B3d";
  if (!senderAddress) throw Error("Must set multisig signer address");
  const treasury = await impersonateAccount(ENSO_TREASURY_MULTISIG);

  const liquidityMigration = liveMigrationContract(treasury);

  //Gnosis safe
  const safeAddress = ENSO_TREASURY_MULTISIG;
  const ethAdapter = new EthersAdapter({ ethers: hre.ethers, signer: treasury });
  const safeSdk = await Safe.create({ ethAdapter, safeAddress });
  const safeService = new SafeServiceClient({
    txServiceUrl: "https://safe-transaction.gnosis.io",
    ethAdapter,
  });

  //Get migrated lps
  const strategiesToSet: any = {};
  const transactions: MetaTransactionData[] = [];

  const strategies: DeployedContracts = deployedStrategies;
  const lps = Object.keys(strategies);

  // Encode calls to setStrategies for each lp
  for (let i = 0; i < lps.length; i++) {
    const lp: string = lps[i];
    try {
      console.log("Setting strategy: ", lp, strategies[lp]);
      const tx = await liquidityMigration.populateTransaction.setStrategy(lp, strategies[lp]);
      transactions.push(validateAndEncode(tx));
      strategiesToSet[lp] = strategies[lp];
    } catch (e) {
      console.log(e);
    }
  }

  // If the strategies haven't been set yet create transaction to do so
  if (Object.keys(strategiesSet).length == 0) {
    console.log("Saving set strategies to out/strategies_set.json");
    write2File("strategies_set.json", strategiesToSet);
    const safeTransaction = await safeSdk.createTransaction(transactions);
    const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
    await safeService.proposeTransaction({
      safeAddress,
      safeTransaction,
      safeTxHash,
      senderAddress,
    });
    const pendingTxs = await safeService.getPendingTransactions(safeAddress);
    const tx = await safeService.getTransaction(safeTxHash);
    if (!tx.dataDecoded) throw Error("Failed to decode transaction");
    write2File("setStrategyDecoded.json", tx.dataDecoded);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
