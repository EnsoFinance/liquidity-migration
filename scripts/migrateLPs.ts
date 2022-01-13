// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from "hardhat";
import * as fs from "fs";
import deployments from "../deployments.json";
import migrations from "../out/above_threshold/above_15_threshold.json"
import { MigrationCoordinator__factory } from "../typechain";
const { BigNumber } = hre.ethers

const MAX_LENGTH = 200
const MAX_GAS_PRICE = BigNumber.from('75000000000') // 75 gWEI
//const MAX_GAS_PRICE = BigNumber.from('240000000000') // 240 gWEI

const network = process.env.HARDHAT_NETWORK ?? hre.network.name;

const getMigrator = async (hre: any) => {
  const network = process.env.HARDHAT_NETWORK ?? hre.network.name;
  if (network != "localhost" && network != "hardhat") {
    const [migrator] = await hre.ethers.getSigners();
    console.log("Migrator: ", migrator.address);
    console.log("Network: ", network);
    return migrator.address;
  } else {
    const owner = "0x007A8CFf81A9FCca63E8a05Acb41A8292F4b353e";
    console.log("Migrator: ", owner);
    console.log("Network: ", network);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner],
    });
    return owner;
  }
};

async function main() {
  if (network) {
    const migrator = await getMigrator(hre);
    const signer = await hre.ethers.getSigner(migrator);

    // @ts-ignore
    const deploymentAddresses = deployments[network];
    const migrationCoordinatorAddress = deploymentAddresses["MigrationCoordinator"];

    const migrationCoordinator = MigrationCoordinator__factory.connect(migrationCoordinatorAddress, signer);

    let totalGas = BigNumber.from('0')
    try {
        while (migrations.length > 0) {
            console.log("\nNumber of migrations to go: ", migrations.length)

            const migrationData = migrations[0]; // The next value will always be 0
            console.log("\nMigrating LP: ", migrationData["lp"]);
            console.log("Adapter: ", migrationData["adapter"]);

            let users = migrationData["users"]
            console.log("Total Users: ", users.length);
            while (users.length > 0) {
                let subset = users.length > MAX_LENGTH ? users.slice(0,MAX_LENGTH) : users
                console.log("\nUsers migrating: ", subset.length);
                const gasPrice = await waitForLowGas(signer);
                const tx = await migrationCoordinator.migrateLP(subset, migrationData["lp"], migrationData["adapter"], { gasPrice: gasPrice });
                console.log("Migrated!");
                const receipt = await tx.wait()
                const gasUsed = receipt.gasUsed;
                console.log("Gas used: ", gasUsed.toString())
                totalGas = totalGas.add(gasUsed)
                console.log("Total gas: ", totalGas.toString())
                users = users.slice(subset.length, users.length)
                migrations[0]["users"] = users
                write2File() // Save to document
            }
            migrations.shift() // Remove item from array
            write2File() // Save to document
        }
    } catch (e) {
      console.log("Error: ", e);
    }
  } else {
    console.log("Network undefined");
  }
}

const waitForLowGas = async (signer: any) => {
  return new Promise<any>(async (resolve) => {
    const estimatedGasPrice = await signer.getGasPrice()
    let gasPrice = estimatedGasPrice.add(estimatedGasPrice.div(10)) // Pay 10% over current price
    console.log("Gas price: ", gasPrice.toString())
    if (gasPrice.gt(MAX_GAS_PRICE)) {
        console.log("Gas too high. Waiting 60 seconds...");
        setTimeout(async () => {
          gasPrice = await waitForLowGas(signer);
          resolve(gasPrice);
        }, 60000);
    } else {
        resolve(gasPrice);
    }
  });
}

const write2File = () => {
  const data = JSON.stringify(
    migrations,
    null,
    2,
  );
  fs.writeFileSync("./out/above_threshold/above_15_threshold.json", data);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });