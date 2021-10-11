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
    TokenSetsBasicIssuanceModule: "0xd8EF3cACe8b4907117a45B0b125c68560532F94D",
    TokenSetsDebtIssuanceModule: "0x39f024d621367c044bace2bf0fb15fb3612ecb92",
  },
  kovan: {
    GenericRouter: "0xE0a9382c01d6EDfA0c933714b3626435EeF10811",
    StrategyProxyFactory: "0xaF80BB1794B887de4a6816Ab0219692a21e8430e",
    StrategyController: "0x077a70998D5086E6c6D53D9Fb7BCfd8F7fb73AC2",
    TokenSetsBasicIssuanceModule: "0x8a070235a4B9b477655Bf4Eb65a1dB81051B3cC1",
    TokenSetsDebtIssuanceModule: "0xe34031E7F4D8Ba4eFab190ce5f4D8451eD1B6A82",
  },
  hardhat: {
    GenericRouter: "0xE0a9382c01d6EDfA0c933714b3626435EeF10811",
    StrategyProxyFactory: "0xaF80BB1794B887de4a6816Ab0219692a21e8430e",
    StrategyController: "0x077a70998D5086E6c6D53D9Fb7BCfd8F7fb73AC2",
    TokenSetsBasicIssuanceModule: "0x8a070235a4B9b477655Bf4Eb65a1dB81051B3cC1",
    TokenSetsDebtIssuanceModule: "0x39f024d621367c044bace2bf0fb15fb3612ecb92",
  },
  localhost: {
    GenericRouter: "",
    StrategyProxyFactory: "",
    StrategyController: "",
    TokenSetsBasicIssuanceModule: "0xd8EF3cACe8b4907117a45B0b125c68560532F94D",
    TokenSetsDebtIssuanceModule: "0x39f024d621367c044bace2bf0fb15fb3612ecb92",
  },
};

const owner = "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b";
const initialURI = "https://token-cdn-domain/{id}.json";
const max = 3;
const protocols = [0, 1, 2]; // 0 = TS, 1 = pie, 3 = indexed
const supply = 1000;
const state = [0, 1, 2]; // 0 = pending, 1 = active, 2 = closed

async function main() {
  getMonorepoDeployments();
  if (network) {
    const protocol_addresses = [];
    const TokenSetAdapterFactory = await hre.ethers.getContractFactory("TokenSetAdapter");
    const tokenSetAdapter = await TokenSetAdapterFactory.deploy(
      deployedContracts[network].TokenSetsBasicIssuanceModule,
      deployedContracts[network].TokenSetsDebtIssuanceModule,
      deployedContracts[network].GenericRouter,
      owner,
    );
    await tokenSetAdapter.deployed();
    log("TokenSetAdapter", tokenSetAdapter.address);
    protocol_addresses.push(tokenSetAdapter.address);

    const BalancerAdapterFactory = await hre.ethers.getContractFactory("BalancerAdapter");
    const BalancerAdapter = await BalancerAdapterFactory.deploy(owner);
    await BalancerAdapter.deployed();
    log("BalancerAdapter", BalancerAdapter.address);
    protocol_addresses.push(BalancerAdapter.address);

    const PieDaoAdapterFactory = await hre.ethers.getContractFactory("PieDaoAdapter");
    const pieDaoAdapter = await PieDaoAdapterFactory.deploy(owner);
    await pieDaoAdapter.deployed();
    log("PieDaoAdapter", pieDaoAdapter.address);
    protocol_addresses.push(pieDaoAdapter.address);

    const unlock = await getBlockTime(60);

    const LiquidityMigrationFactory = await hre.ethers.getContractFactory("LiquidityMigration");
    const liquidityMigration = await LiquidityMigrationFactory.deploy(
      [tokenSetAdapter.address, BalancerAdapter.address, pieDaoAdapter.address],
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
    await claimable.stateChange(state[1]);
    console.log("State updated: Migrate all the competitors *evil laugh*");
    write2File();
  } else {
    console.log("Network undefined");
  }
}

const getMonorepoDeployments = () => {
  console.log("monoRepoDeployments: ", monoRepoDeployments);
  if (monoRepoDeployments) {
    try {
      const file = fs.readFileSync(monoRepoDeployments, "utf8");
      if (file) {
        const monorepoContracts = JSON.parse(file);
        console.log(monorepoContracts);
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
