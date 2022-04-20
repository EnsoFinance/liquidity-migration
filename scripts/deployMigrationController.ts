// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from "hardhat";
import * as fs from "fs";
import { waitForDeployment, TransactionArgs } from "./common";
import deployments from "../deployments.json";

const strategyProxyFactory = "0x0d697f2b1F9b543d57D62f68c2b0296260709af6";
const treasury = "0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F";

const network = process.env.HARDHAT_NETWORK ?? hre.network.name;

async function main() {
  if (network) {
    const [signer] = await hre.ethers.getSigners();

    // @ts-ignore
    const deploymentAddresses = deployments[network];

    const MigrationController = await hre.ethers.getContractFactory("MigrationController");
    const migrationController = await waitForDeployment(async (txArgs: TransactionArgs) => {
      return MigrationController.deploy(
        strategyProxyFactory,
        deploymentAddresses.LiquidityMigrationV2,
        treasury,
        txArgs,
      );
    }, signer);
    log("MigrationControllerImplementation", migrationController.address);

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
