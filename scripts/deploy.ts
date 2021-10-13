// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from "hardhat";
import { getBlockTime } from "../src/utils";
import * as fs from "fs";
import deployments from "../deployments.json";

const monoRepoDeployments = process.env.MONOREPO_DEPLOYMENTS_FILE;
const network = process.env.HARDHAT_NETWORK ?? "localhost";

const deployedContracts: any = {
  mainnet: {
    GenericRouter: "",
    StrategyProxyFactory: "",
    StrategyController: "",
    Leverage2XAdapter: "",
    TokenSetsBasicIssuanceModule: "0xd8EF3cACe8b4907117a45B0b125c68560532F94D",
    TokenSetsDebtIssuanceModule: "0x39f024d621367c044bace2bf0fb15fb3612ecb92",
    SUSD: "0x57ab1ec28d129707052df4df418d58a2d46d5f51",
  },
  kovan: {
    GenericRouter: "0xE0a9382c01d6EDfA0c933714b3626435EeF10811",
    StrategyProxyFactory: "0xaF80BB1794B887de4a6816Ab0219692a21e8430e",
    StrategyController: "0x077a70998D5086E6c6D53D9Fb7BCfd8F7fb73AC2",
    Leverage2XAdapter: "",
    TokenSetsBasicIssuanceModule: "0x8a070235a4B9b477655Bf4Eb65a1dB81051B3cC1",
    TokenSetsDebtIssuanceModule: "0xe34031E7F4D8Ba4eFab190ce5f4D8451eD1B6A82",
    SUSD: "0x57ab1ec28d129707052df4df418d58a2d46d5f51",
  },
  hardhat: {
    GenericRouter: "",
    StrategyProxyFactory: "",
    StrategyController: "",
    Leverage2XAdapter: "",
    TokenSetsBasicIssuanceModule: "0xd8EF3cACe8b4907117a45B0b125c68560532F94D",
    TokenSetsDebtIssuanceModule: "0x39f024d621367c044bace2bf0fb15fb3612ecb92",
    SUSD: "0x57ab1ec28d129707052df4df418d58a2d46d5f51",
  },
};
deployedContracts.localhost = deployedContracts.mainnet;
deployedContracts.localhost.Leverage2XAdapter = "0x57ab1ec28d129707052df4df418d58a2d46d5f51"; // dummy data

const owner = "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b";
const initialURI = "https://token-cdn-domain/{id}.json";
const max = 6;
const supply = 1000;

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
    const protocol_addresses = [];
    const TokenSetAdapterFactory = await hre.ethers.getContractFactory("TokenSetAdapter");
    const BalancerAdapterFactory = await hre.ethers.getContractFactory("BalancerAdapter");
    const PieDaoAdapterFactory = await hre.ethers.getContractFactory("PieDaoAdapter");
    const DHedgeAdapterFactory = await hre.ethers.getContractFactory("DHedgeAdapter");

    const tokenSetAdapter = await TokenSetAdapterFactory.deploy(
      deployedContracts[network].TokenSetsBasicIssuanceModule,
      deployedContracts[network].Leverage2XAdapter,
      deployedContracts[network].GenericRouter,
      owner,
    );
    await tokenSetAdapter.deployed();
    log("TokenSetAdapter", tokenSetAdapter.address);
    protocol_addresses[PROTOCOLS.TOKENSET] = tokenSetAdapter.address;

    const pieDaoAdapter = await PieDaoAdapterFactory.deploy(owner);
    await pieDaoAdapter.deployed();
    log("PieDaoAdapter", pieDaoAdapter.address);
    protocol_addresses[PROTOCOLS.PIEDAO] = pieDaoAdapter.address;

    const indexedAdapter = await BalancerAdapterFactory.deploy(owner);
    await indexedAdapter.deployed();
    log("IndexedAdapter", indexedAdapter.address);
    protocol_addresses[PROTOCOLS.INDEXED] = indexedAdapter.address;

    const indexCoopAdapter = await TokenSetAdapterFactory.deploy(
      deployedContracts[network].TokenSetsBasicIssuanceModule,
      deployedContracts[network].Leverage2XAdapter,
      deployedContracts[network].GenericRouter,
      owner,
    );
    await indexCoopAdapter.deployed();
    log("IndexCoopAdapter", indexCoopAdapter.address);
    protocol_addresses[PROTOCOLS.INDEXCOOP] = indexCoopAdapter.address;

    const dHedgeAdapter = await DHedgeAdapterFactory.deploy(owner, deployedContracts[network].SUSD);
    await dHedgeAdapter.deployed();
    log("DHedgeAdapter", dHedgeAdapter.address);
    protocol_addresses[PROTOCOLS.DHEDGE] = dHedgeAdapter.address;

    const powerPoolAdapter = await BalancerAdapterFactory.deploy(owner);
    await powerPoolAdapter.deployed();
    log("PowerPoolAdapter", powerPoolAdapter.address);
    protocol_addresses[PROTOCOLS.POWERPOOL] = powerPoolAdapter.address;

    const unlock = await getBlockTime(60);

    const LiquidityMigrationFactory = await hre.ethers.getContractFactory("LiquidityMigration");
    const liquidityMigration = await LiquidityMigrationFactory.deploy(
      protocol_addresses,
      deployedContracts[network].GenericRouter,
      deployedContracts[network].StrategyProxyFactory,
      deployedContracts[network].StrategyController,
      unlock,
      hre.ethers.constants.MaxUint256,
      owner,
    );
    await liquidityMigration.deployed();
    log("LiquidityMigration", liquidityMigration.address);

    const ERC1155Factory = await hre.ethers.getContractFactory("Root1155");
    const erc1155 = await ERC1155Factory.deploy(initialURI);
    log("ERC1155", erc1155.address);
    const Claimable = await hre.ethers.getContractFactory("Claimable");
    const claimable = await Claimable.deploy(liquidityMigration.address, erc1155.address, max, protocol_addresses);
    for (let i = 0; i < max; i++) {
      await erc1155.create(claimable.address, supply, initialURI, "0x");
    }
    log("Claimable", claimable.address);
    await claimable.stateChange(STATE.ACTIVE);
    console.log("State updated: Migrate all the competitors *evil laugh*");
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
  const data = JSON.stringify({ ...deployments, [network]: contracts }, null, 2);
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
