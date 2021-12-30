// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from "hardhat";
import { getBlockTime } from "../src/utils";
import * as fs from "fs";
import deployments from "../deployments.json";

const unlock = 1643112000; // Jan 25 2022
const modify = 1643112000;
const monoRepoDeployments = process.env.MONOREPO_DEPLOYMENTS_FILE;
const network = process.env.HARDHAT_NETWORK ?? hre.network.name;

const { AddressZero } = hre.ethers.constants;

const deployedContracts: any = {
  mainnet: {
    GenericRouter: AddressZero,
    StrategyProxyFactory: AddressZero,
    StrategyController: AddressZero,
    Leverage2XAdapter: AddressZero,
    TokenSetsBasicIssuanceModule: "0xd8EF3cACe8b4907117a45B0b125c68560532F94D",
    TokenSetsDebtIssuanceModule: "0x39f024d621367c044bace2bf0fb15fb3612ecb92",
    SUSD: "0x57ab1ec28d129707052df4df418d58a2d46d5f51",
  },
  kovan: {
    GenericRouter: "0xE0a9382c01d6EDfA0c933714b3626435EeF10811",
    StrategyProxyFactory: "0xaF80BB1794B887de4a6816Ab0219692a21e8430e",
    StrategyController: "0x077a70998D5086E6c6D53D9Fb7BCfd8F7fb73AC2",
    Leverage2XAdapter: AddressZero,
    TokenSetsBasicIssuanceModule: "0x8a070235a4B9b477655Bf4Eb65a1dB81051B3cC1",
    TokenSetsDebtIssuanceModule: "0xe34031E7F4D8Ba4eFab190ce5f4D8451eD1B6A82",
    SUSD: "0x57ab1ec28d129707052df4df418d58a2d46d5f51",
  },
  hardhat: {
    GenericRouter: AddressZero,
    StrategyProxyFactory: AddressZero,
    StrategyController: AddressZero,
    Leverage2XAdapter: AddressZero,
    TokenSetsBasicIssuanceModule: "0xd8EF3cACe8b4907117a45B0b125c68560532F94D",
    TokenSetsDebtIssuanceModule: "0x39f024d621367c044bace2bf0fb15fb3612ecb92",
    SUSD: "0x57ab1ec28d129707052df4df418d58a2d46d5f51",
  },
};

deployedContracts.localhost = deployedContracts.mainnet;
deployedContracts.localhost.Leverage2XAdapter = "0x57ab1ec28d129707052df4df418d58a2d46d5f51"; // dummy data

const treasury = "0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F"

const getDeployer = async () => {
  if (network != "localhost") {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer: ", deployer.address);
    console.log("Network: ", network);
    return deployer.address;
  } else {
    console.log("Deployer: 0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b");
    console.log("Network: ", network);
    return "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b";
  }
};

enum PROTOCOLS {
  TOKENSET,
  PIEDAO,
  INDEXED,
  INDEXCOOP,
  DHEDGE,
  POWERPOOL,
}

enum STATE {
  PENDING,
  ACTIVE,
  CLOSED,
}

async function main() {
  getMonorepoDeployments();
  if (network) {
    const deployer = await getDeployer();
    const protocol_addresses = [];
    // @ts-ignore
    protocol_addresses[PROTOCOLS.INDEXCOOP] = deployments[network]['IndexCoopAdapter']
    // @ts-ignore
    protocol_addresses[PROTOCOLS.INDEXED] = deployments[network]['IndexedAdapter']
    // @ts-ignore
    protocol_addresses[PROTOCOLS.POWERPOOL] = deployments[network]['PowerPoolAdapter']
    // @ts-ignore
    protocol_addresses[PROTOCOLS.TOKENSET] = deployments[network]['TokenSetAdapter']
    // @ts-ignore
    protocol_addresses[PROTOCOLS.DHEDGE] = deployments[network]['DHedgeAdapter']
    // @ts-ignore
    protocol_addresses[PROTOCOLS.PIEDAO] = deployments[network]['PieDaoAdapter']
    // @ts-ignore
    const liquidityMigrationAddress = deployments[network]['LiquidityMigration']

    const LiquidityMigrationV2Factory = await hre.ethers.getContractFactory("LiquidityMigrationV2");
    const liquidityMigrationV2 = await LiquidityMigrationV2Factory.deploy(
      protocol_addresses,
      unlock,
      modify
    );
    await liquidityMigrationV2.deployed();
    log("LiquidityMigrationV2", liquidityMigrationV2.address);

    const MigrationAdapterFactory = await hre.ethers.getContractFactory('MigrationAdapter')
    const migrationAdapter = await MigrationAdapterFactory.deploy(deployer)
    await migrationAdapter.deployed()
    log("MigrationAdapter", migrationAdapter.address);

    const MigrationCoordinatorFactory = await hre.ethers.getContractFactory('MigrationCoordinator')
    const migrationCoordinator = await MigrationCoordinatorFactory.deploy(
      treasury,
      liquidityMigrationAddress,
      liquidityMigrationV2.address,
      migrationAdapter.address
    )
    await migrationCoordinator.deployed()
    log("MigrationCoordinator", migrationCoordinator.address);
    // Update coordinator on LMV2
    await liquidityMigrationV2.updateCoordinator(migrationCoordinator.address)
    // Transfer ownership of LMV2
    await liquidityMigrationV2.transferOwnership(treasury)

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

const getMonorepoDeployments = () => {
  if (monoRepoDeployments) {
    try {
      const file = fs.readFileSync(monoRepoDeployments, "utf8");
      if (file) {
        const monorepoContracts = JSON.parse(file);
        deployedContracts[network] = { ...deployedContracts[network], ...monorepoContracts[network] };
      }
    } catch (e) {
      console.error(e);
    }
  }
};

const contracts: any = {};
const log = (contractTitle: string, address: string) => {
  contracts[contractTitle] = address;
  console.log(contractTitle + ": " + address);
};

const write2File = () => {
  const data = JSON.stringify({
    ...deployments,
    [network]: {
      // @ts-ignore
      ...deployments[network],
      ...contracts
    }
  }, null, 2);
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
