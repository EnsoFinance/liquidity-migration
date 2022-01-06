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
    const signer = await hre.ethers.getSigner(deployer);

    const estimatedGasPrice = await signer.getGasPrice()
    const gasPrice = estimatedGasPrice.add(estimatedGasPrice.div(10))

    // @ts-ignore
    const deploymentAddresses = deployments[network];
    const liquidityMigrationAddress = deploymentAddresses["LiquidityMigration"];

    const adapters = [];
    adapters[PROTOCOLS.INDEXCOOP] = deploymentAddresses["IndexCoopAdapter"];
    adapters[PROTOCOLS.INDEXED] = deploymentAddresses["IndexedAdapter"];
    adapters[PROTOCOLS.POWERPOOL] = deploymentAddresses["PowerPoolAdapter"];
    adapters[PROTOCOLS.TOKENSET] = deploymentAddresses["TokenSetAdapter"];
    adapters[PROTOCOLS.DHEDGE] = deploymentAddresses["DHedgeAdapter"];
    adapters[PROTOCOLS.PIEDAO] = deploymentAddresses["PieDaoAdapter"];

    const LiquidityMigrationV2Factory = await hre.ethers.getContractFactory("LiquidityMigrationV2");
    const liquidityMigrationV2 = await LiquidityMigrationV2Factory.connect(signer).deploy(adapters, unlock, modify, { gasPrice: gasPrice });
    await liquidityMigrationV2.deployed();
    log("LiquidityMigrationV2", liquidityMigrationV2.address);

    const MigrationAdapterFactory = await hre.ethers.getContractFactory("MigrationAdapter");
    const migrationAdapter = await MigrationAdapterFactory.connect(signer).deploy(deployer, { gasPrice: gasPrice });
    await migrationAdapter.deployed();
    log("MigrationAdapter", migrationAdapter.address);

    const MigrationCoordinatorFactory = await hre.ethers.getContractFactory("MigrationCoordinator");
    const migrationCoordinator = await MigrationCoordinatorFactory.connect(signer).deploy(
      treasury,
      liquidityMigrationAddress,
      liquidityMigrationV2.address,
      migrationAdapter.address,
      { gasPrice: gasPrice }
    );
    await migrationCoordinator.deployed();
    log("MigrationCoordinator", migrationCoordinator.address);
    // Update coordinator on LMV2
    await liquidityMigrationV2.connect(signer).updateCoordinator(migrationCoordinator.address, { gasPrice: gasPrice });
    // Transfer ownership of LMV2
    await liquidityMigrationV2.connect(signer).transferOwnership(treasury, { gasPrice: gasPrice });

    /* TODO
     * 1) Add all LPs to MigrationAdapter
     * 2) Transfer ownership of LiquidityMigration to MigrationCoordinator
     * 3) Call initiateMigration() on MigrationCoordinator
     * 4) Call migrateLP() on batches of users
     */

    write2File();
  } else {
    console.log("Network undefined");
  }
}

const contracts: any = {};
const log = (contractTitle: string, address: string) => {
  contracts[contractTitle] = address;
  console.log(contractTitle + ": " + address);
};

const write2File = () => {
  const data = JSON.stringify(
    {
      ...deployments,
      [network]: {
        // @ts-ignore
        ...deployments[network],
        ...contracts,
      },
    },
    null,
    2,
  );
  fs.writeFileSync("./deployments.json", data);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
