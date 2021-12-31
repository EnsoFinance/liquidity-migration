// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from "hardhat";
import * as fs from "fs";
import deployments from "../deployments.json";
import { getOwner } from "../tasks/whitelistStrategy";

const unlock = 1643112000; // Jan 25 2022
const modify = 1643112000;
const treasury = "0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F";

const network = process.env.HARDHAT_NETWORK ?? hre.network.name;

enum PROTOCOLS {
  TOKENSET,
  PIEDAO,
  INDEXED,
  INDEXCOOP,
  DHEDGE,
  POWERPOOL,
}

async function main() {
  if (network) {
    const deployer = await getOwner(hre);
    // @ts-ignore
    const deploymentAddresses = deployments[network];
    const liquidityMigrationAddress = deploymentAddresses['LiquidityMigration'];
    const liquidityMigrationV2Address = deploymentAddresses['LiquidityMigrationV2'];
    const migrationAdapterAddress = deploymentAddresses['MigrationAdapter'];

    const adapters = [];
    adapters[PROTOCOLS.INDEXCOOP] = deploymentAddresses["IndexCoopAdapter"];
    adapters[PROTOCOLS.INDEXED] = deploymentAddresses["IndexedAdapter"];
    adapters[PROTOCOLS.POWERPOOL] = deploymentAddresses["PowerPoolAdapter"];
    adapters[PROTOCOLS.TOKENSET] = deploymentAddresses["TokenSetAdapter"];
    adapters[PROTOCOLS.DHEDGE] = deploymentAddresses["DHedgeAdapter"];
    adapters[PROTOCOLS.PIEDAO] = deploymentAddresses["PieDaoAdapter"];

    await hre.run("verify:verify", {
      address: liquidityMigrationV2Address,
      constructorArguments: [adapters, unlock, modify],
    });

    await hre.run("verify:verify", {
      address: migrationAdapterAddress,
      constructorArguments: [deployer],
    });

    await hre.run("verify:verify", {
      address: deploymentAddresses['MigrationCoordinator'],
      constructorArguments: [
        treasury,
        liquidityMigrationAddress,
        liquidityMigrationV2Address,
        migrationAdapterAddress
      ],
    });
  } else {
    console.log("Network undefined");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
