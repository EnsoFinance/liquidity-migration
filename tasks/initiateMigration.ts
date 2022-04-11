import { task } from "hardhat/config";
import deployments from "../deployments.json";
import { INITIATE_MIGRATION } from "./task-names";
import { getOwner } from "./whitelistStrategy";
import { Ownable__factory, MigrationCoordinator__factory } from "../typechain";

enum PROTOCOLS {
  TOKENSET,
  PIEDAO,
  INDEXED,
  INDEXCOOP,
  DHEDGE,
  POWERPOOL,
}

task(INITIATE_MIGRATION, "Initiate migration", async (_taskArgs, hre) => {
  const network = process.env.HARDHAT_NETWORK ?? hre.network.name;
  // @ts-ignore
  const addresses = deployments[network];

  const liquidityMigrationV1Address = addresses['LiquidityMigration'];
  const migrationCoordinatorAddress = addresses['MigrationCoordinator'];

  const adapterAddresses = [];
  adapterAddresses[PROTOCOLS.INDEXCOOP] = addresses['IndexCoopAdapter']
  adapterAddresses[PROTOCOLS.INDEXED] = addresses['IndexedAdapter']
  adapterAddresses[PROTOCOLS.POWERPOOL] = addresses['PowerPoolAdapter']
  adapterAddresses[PROTOCOLS.TOKENSET] = addresses['TokenSetAdapter']
  adapterAddresses[PROTOCOLS.DHEDGE] = addresses['DHedgeAdapter']
  adapterAddresses[PROTOCOLS.PIEDAO] = addresses['PieDaoAdapter']

  console.log("Adapters: ", adapterAddresses)

  const owner = await getOwner(hre);
  const ownerSigner = await hre.ethers.getSigner(owner);

  const liquidityMigration = Ownable__factory.connect(liquidityMigrationV1Address, ownerSigner);
  const currentOwner = await liquidityMigration.owner();
  if (currentOwner == migrationCoordinatorAddress) {
    console.log("Initate migration...");
    const migrationCoordinator = MigrationCoordinator__factory.connect(migrationCoordinatorAddress, ownerSigner);
    await migrationCoordinator.initiateMigration(adapterAddresses);
    console.log("Migration initiated");
  } else {
    console.log("Not owner!");
  }
  console.log("Complete")
});
