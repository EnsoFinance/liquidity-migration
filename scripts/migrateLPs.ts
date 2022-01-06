// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from "hardhat";
import * as fs from "fs";
import deployments from "../deployments.json";
import migrations from "../out/above_threshold.json"
import { MigrationCoordinator__factory } from "../typechain";

//const MAX_GAS_PRICE = hre.ethers.BigNumber.from('60000000000') // 60 gWEI
const MAX_GAS_PRICE = hre.ethers.BigNumber.from('240000000000') // 240 gWEI

const MAX_LENGTH = 150

const network = process.env.HARDHAT_NETWORK ?? hre.network.name;


const getMigrator = async (hre: any) => {
  const network = process.env.HARDHAT_NETWORK ?? hre.network.name;
  if (network != "localhost") {
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

    try {
        while (migrations.length > 0) {
            console.log("Number of migrations to go: ", migrations.length)

            const migrationData = migrations[0]; // The next value will always be 0
            console.log("Migrating LP: ", migrationData["lp"]);
            console.log("Adapter: ", migrationData["adapter"]);

            let users = migrationData["users"]
            console.log("Total Users: ", users.length);
            while (users.length > 0) {
                let subset = users.length > MAX_LENGTH ? users.slice(0,MAX_LENGTH) : users
                console.log("Users migrating: ", subset.length);

                const estimatedGasPrice = await signer.getGasPrice()
                const gasPrice = estimatedGasPrice.add(estimatedGasPrice.div(10))
                console.log("Gas price: ", gasPrice.toString())
                if (gasPrice.gt(MAX_GAS_PRICE)) throw Error(`Gas too high: ${gasPrice.toString()}`);

                const tx = await migrationCoordinator.migrateLP(subset, migrationData["lp"], migrationData["adapter"]);
                console.log("Migrated!");
                const receipt = await tx.wait()
                console.log("Gas used: ", receipt.gasUsed.toString())
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

const write2File = () => {
  const data = JSON.stringify(
    migrations,
    null,
    2,
  );
  fs.writeFileSync("./out/above_threshold.json", data);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
