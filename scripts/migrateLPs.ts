// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from "hardhat";
import * as fs from "fs";
import deployments from "../deployments.json";
import migrations from "../out/above_threshold/above_10_threshold.json"
import { MigrationCoordinator__factory } from "../typechain";
const { provider, BigNumber } = hre.ethers

const MAX_LENGTH = 150
const MAX_GAS_PRICE = BigNumber.from('85000000000') // 85 gWEI
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
                const tip = await waitForLowGas(signer);
                let tx;
                try {
                    tx = await migrationCoordinator.migrateLP(
                      subset,
                      migrationData["lp"],
                      migrationData["adapter"],
                      {
                        maxPriorityFeePerGas: tip,
                        maxFeePerGas: MAX_GAS_PRICE
                      }
                    );
                } catch (e) {
                    if (e.toString().includes('max fee per gas less than block base fee')) {
                      //try again
                      console.log(e);
                      continue;
                    } else {
                      throw new Error(e);
                    }
                }
                console.log("Migrated!");
                users = users.slice(subset.length, users.length)
                migrations[0]["users"] = users
                write2File() // Save to document
                const receipt = await tx.wait()
                const gasUsed = receipt.gasUsed;
                console.log("Gas used: ", gasUsed.toString())
                totalGas = totalGas.add(gasUsed)
                console.log("Total gas: ", totalGas.toString())
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
    const blockNumber = await provider.getBlockNumber()
    console.log("Next Block: ", blockNumber + 1)
    const [ block, feeData ] = await Promise.all([
      provider.getBlock(blockNumber),
      signer.getFeeData()
    ])
    const expectedBaseFee = getExpectedBaseFee(block)
    if (expectedBaseFee.eq('0')) {
        console.log("Bad block. Waiting 15 seconds...");
        setTimeout(async () => {
          tip = await waitForLowGas(signer);
          resolve(tip);
        }, 15000);
    }
    // Pay 10% over expected tip
    let tip = feeData.maxPriorityFeePerGas.add(feeData.maxPriorityFeePerGas.div(10))
    const estimatedGasPrice = expectedBaseFee.add(tip)

    console.log("Expected Base Fee: ", expectedBaseFee.toString())
    console.log("Estimated Gas Price: ", estimatedGasPrice.toString())
    if (estimatedGasPrice.gt(MAX_GAS_PRICE)) {
        console.log("Gas too high. Waiting 15 seconds...");
        setTimeout(async () => {
          tip = await waitForLowGas(signer);
          resolve(tip);
        }, 15000);
    } else {
        resolve(tip);
    }
  });
}

const getExpectedBaseFee = (block: any) => {
  let expectedBaseFee = BigNumber.from('0')
  if (block?.baseFeePerGas) {
    const target = block.gasLimit.div(2)
    if (block.gasUsed.gt(target)) {
        const diff = block.gasUsed.sub(target);
        expectedBaseFee = block.baseFeePerGas.add(block.baseFeePerGas.mul(1000).div(8).mul(diff).div(target).div(1000))
    } else {
        const diff = target.sub(block.gasUsed);
        expectedBaseFee = block.baseFeePerGas.sub(block.baseFeePerGas.mul(1000).div(8).mul(diff).div(target).div(1000))
    }
  }
  return expectedBaseFee
}

const write2File = () => {
  const data = JSON.stringify(
    migrations,
    null,
    2,
  );
  fs.writeFileSync("./out/above_threshold/above_10_threshold.json", data);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
