import hre from "hardhat";
import { BigNumber, UnsignedTransaction } from "ethers";
import { Adapters } from "../../src/types";
import { ENSO_CONTRACTS_MULTISIG, ENSO_TREASURY_MULTISIG } from "../../src/constants";
import { impersonateAccount, liveMigrationContract, getAdapterFromType } from "../../src/mainnet";
import { EthersUnsigned, encodeMulticall, validateAndEncode } from "../../scripts/common";
import { getLiveContracts } from "@ensofinance/v1-core";
import deployments from "../../deployments.json";
import EthersAdapter from "@gnosis.pm/safe-ethers-lib";
import { MetaTransactionData } from "@gnosis.pm/safe-core-sdk-types";
import Safe from "@gnosis.pm/safe-core-sdk";
import SafeServiceClient from "@gnosis.pm/safe-service-client";

async function main() {
  // TODO: read this from .env?
  // Multisig signer address
  const senderAddress = "0x05d0cf613e9a140fAbdb33Fd7e8d8009F6Df8B3d";
  if (!senderAddress) throw Error("Must set multisig signer address");
  const sender = await impersonateAccount(senderAddress);
  const treasury = await impersonateAccount(ENSO_TREASURY_MULTISIG);
  const enso = getLiveContracts(treasury);
  // Gnosis expected type
  const transactions: MetaTransactionData[] = [];
  //Impersonate Treasury Multisig
  const safeAddress = treasury.address;
  const liquidityMigration = await liveMigrationContract(treasury);
  const indexCoopAdapter = await getAdapterFromType(Adapters.IndexCoopAdapter, treasury);
  const tokenSetAdapter = await getAdapterFromType(Adapters.TokenSetAdapter, treasury);

  if (!treasury.provider) throw Error("No provider");
  // initialize safe
  const ethAdapter = new EthersAdapter({ ethers: hre.ethers, signer: treasury });
  const safeService = new SafeServiceClient({
    txServiceUrl: "https://safe-transaction.gnosis.io",
    ethAdapter,
  });
  const safeInfo = await safeService.getSafeInfo(safeAddress);
  console.log("Safe data: ", safeInfo, "\n\n\n");

  // TODO: connect() not found on typeof Safe ??
  console.log(Object.keys(Safe));
  const safeSdk = await Safe.create({ ethAdapter, safeAddress });

  //Add MulticallRouter + StrategyController to LiquidityMigrationV2
  console.log("Updating controller on LiquidityMigration2...");
  const updateControllerTx = await liquidityMigration.populateTransaction.updateController(
    enso.platform.controller.address,
  );
  transactions.push(validateAndEncode(updateControllerTx));

  console.log("Updating router on LiquidityMigration2...");
  const migrationGenericRouterTx = await liquidityMigration.populateTransaction.updateGenericRouter(
    enso.routers.multicall.address,
  );
  transactions.push(validateAndEncode(migrationGenericRouterTx));

  //Add MulticallRouter to IndexCoopAdapter + TokenSetAdapter
  console.log("Updating router on IndexedAdapter...");
  const indexCoopGenericRouterTx = await indexCoopAdapter.populateTransaction.updateGenericRouter(
    enso.routers.multicall.address,
  );
  transactions.push(validateAndEncode(indexCoopGenericRouterTx));

  console.log("Updating router on TokenSetAdapter...");
  const tokenSetGenericRouterTx = await tokenSetAdapter.populateTransaction.updateGenericRouter(
    enso.routers.multicall.address,
  );
  transactions.push(validateAndEncode(tokenSetGenericRouterTx));

  //Add Leverage2XAdapter to IndexCoopAdapter
  console.log("Updating leverage adapter on IndexedAdapter...");
  const updateLeverageAdapter = await indexCoopAdapter.populateTransaction.updateLeverageAdapter(
    enso.adapters.leverage.address,
  );
  transactions.push(validateAndEncode(updateLeverageAdapter));

  //Impersonate Upgrade Multisig
  const upgrades = await impersonateAccount(ENSO_CONTRACTS_MULTISIG);

  //Update StrategyController implementation
  console.log("Switching implementation...");
  const upgradeControllerAddress = await enso.platform.administration.platformProxyAdmin
    .connect(upgrades)
    .populateTransaction.upgrade(
      enso.platform.controller.address,
      deployments.mainnet.MigrationControllerImplementation,
    );
  transactions.push(validateAndEncode(upgradeControllerAddress));
  console.log(transactions);

  const safeTransaction = await safeSdk.createTransaction(transactions);
  console.log(safeTransaction);
  const safeTxHash = await safeSdk.getTransactionHash(safeTransaction);
  /*
await safeService.proposeTransaction({
  safeAddress,
  safeTransaction,
  safeTxHash,
  senderAddress: treasurySigner,
})
*/
  const pendingTxs = await safeService.getPendingTransactions(safeAddress);
  console.log(pendingTxs);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
