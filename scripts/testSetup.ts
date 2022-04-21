import hre from "hardhat";
import { BigNumber } from "ethers";
import { Adapters } from "../src/types";
import { ENSO_CONTRACTS_MULTISIG, ENSO_TREASURY_MULTISIG } from "../src/constants";
import { impersonateAccount, liveMigrationContract, getAdapterFromType } from "../src/mainnet";
import { getLiveContracts } from "@ensofinance/v1-core";
import deploymentsJSON from "../deployments.json";
const deployments: { [key: string]: { [key: string]: string } } = deploymentsJSON;

let contracts: { [key: string]: string } = {};
let network: string;
if (process.env.HARDHAT_NETWORK) {
  network = process.env.HARDHAT_NETWORK;
  //ts-ignore
  if (deployments[network]) contracts = deployments[network];
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const enso = getLiveContracts(signer);

  /*
  //Impersonate Treasury Multisig
  const treasury = await impersonateAccount(ENSO_TREASURY_MULTISIG);
  const liquidityMigration = await liveMigrationContract(treasury);
  const indexCoopAdapter = await getAdapterFromType(Adapters.IndexCoopAdapter, treasury);
  const tokenSetAdapter = await getAdapterFromType(Adapters.TokenSetAdapter, treasury);
  //Add MulticallRouter + StrategyController to LiquidityMigrationV2
  console.log("Updating controller on LiquidityMigration2...");
  await liquidityMigration.updateController(enso.platform.controller.address);
  console.log("Updating router on LiquidityMigration2...");
  await liquidityMigration.updateGenericRouter(enso.routers.multicall.address);
  //Add MulticallRouter to IndexCoopAdapter + TokenSetAdapter
  console.log("Updating router on IndexedAdapter...");
  await indexCoopAdapter.updateGenericRouter(enso.routers.multicall.address);
  console.log("Updating router on TokenSetAdapter...");
  await tokenSetAdapter.updateGenericRouter(enso.routers.multicall.address);
  //Add Leverage2XAdapter to IndexCoopAdapter
  console.log("Updating leverage adapter on IndexedAdapter...");
  await indexCoopAdapter.updateLeverageAdapter(enso.adapters.leverage.address);
  */

  //Impersonate Upgrade Multisig
  const upgrades = await impersonateAccount(ENSO_CONTRACTS_MULTISIG);
  //Update StrategyController implementation
  console.log("Switching implementation...");
  await enso.platform.administration.platformProxyAdmin
    .connect(upgrades)
    .upgrade(enso.platform.controller.address, contracts["MigrationControllerImplementation"]);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
