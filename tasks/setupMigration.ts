import { task } from "hardhat/config";
import deployments from "../deployments.json";
import { SETUP_MIGRATION } from "./task-names";
import { getOwner } from "./whitelistStrategy";
import { Ownable__factory, MigrationCoordinator__factory, Claimable__factory } from "../typechain";

enum PROTOCOLS {
  TOKENSET,
  PIEDAO,
  INDEXED,
  INDEXCOOP,
  DHEDGE,
  POWERPOOL,
}

task(SETUP_MIGRATION, "Setup migration coordinator as multisig", async (_taskArgs, hre) => {
  const network = process.env.HARDHAT_NETWORK ?? hre.network.name;
  // @ts-ignore
  const addresses = deployments[network];

  const liquidityMigrationV1Address = addresses['LiquidityMigration'];
  const liquidityMigrationV2Address = addresses['LiquidityMigrationV2'];
  const migrationCoordinatorAddress = addresses['MigrationCoordinator'];
  const claimableAddress = addresses['Claimable'];

  const protocol_addresses = [];
  protocol_addresses[PROTOCOLS.INDEXCOOP] = addresses['IndexCoopAdapter']
  protocol_addresses[PROTOCOLS.INDEXED] = addresses['IndexedAdapter']
  protocol_addresses[PROTOCOLS.POWERPOOL] = addresses['PowerPoolAdapter']
  protocol_addresses[PROTOCOLS.TOKENSET] = addresses['TokenSetAdapter']
  protocol_addresses[PROTOCOLS.DHEDGE] = addresses['DHedgeAdapter']
  protocol_addresses[PROTOCOLS.PIEDAO] = addresses['PieDaoAdapter']

  const treasury = "0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F";
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [treasury],
  });
  const treasurySigner = await hre.ethers.getSigner(treasury);
  console.log("Transferring LiquidityMigration ownership to MigrationCoordinator...")
  const liquidityMigration = Ownable__factory.connect(liquidityMigrationV1Address, treasurySigner);
  const currentOwner = await liquidityMigration.owner();
  if (currentOwner == treasury) {
    await liquidityMigration.transferOwnership(migrationCoordinatorAddress);
    console.log("Ownership successfully transferred!");
    const owner = await getOwner(hre);
    const ownerSigner = await hre.ethers.getSigner(owner);
    console.log("Initate migration...");
    const migrationCoordinator = MigrationCoordinator__factory.connect(migrationCoordinatorAddress, ownerSigner);
    await migrationCoordinator.initiateMigration(protocol_addresses);
    console.log("Migration initiated");
  } else {
    console.log("Not owner!");
  }
  console.log("Updating LiquidityMigration address in Claimable...")
  const claimable = Claimable__factory.connect(claimableAddress, treasurySigner);
  await claimable.updateMigration(liquidityMigrationV2Address);
  console.log("Complete")
});
