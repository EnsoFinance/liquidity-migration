// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from "hardhat";
import { getBlockTime } from "../src/utils";
interface IContracts {
  genericRouter: string;
  strategyProxyFactory: string;
  strategyController: string;
  tokenSetsBasicIssuanceModule: string;
}

const deployedContracts: { [x: string]: IContracts } = {
  mainnet: {
    genericRouter: "0xf5059a5D33d5853360D16C683c16e67980206f36",
    strategyProxyFactory: "0x8Ba41269ed69496c07bea886c300016A0BA8FB5E",
    strategyController: "0xF3c6CF1C13EcC07204BEFce90EE14B5Bf8BbA4c9",
    tokenSetsBasicIssuanceModule: "0xd8EF3cACe8b4907117a45B0b125c68560532F94D",
  },
  localhost: {
    genericRouter: "0x86A2EE8FAf9A840F7a2c64CA3d51209F9A02081D",
    strategyProxyFactory: "0x0860ACac9452853bC9465986312f23b8161A1095",
    strategyController: "0x41189e7d9bec2b7f2A361972833C3a80B1A27107",
    tokenSetsBasicIssuanceModule: "0xd8EF3cACe8b4907117a45B0b125c68560532F94D",
  },
  kovan: {
    genericRouter: "0xE0a9382c01d6EDfA0c933714b3626435EeF10811",
    strategyProxyFactory: "0xaF80BB1794B887de4a6816Ab0219692a21e8430e",
    strategyController: "0x077a70998D5086E6c6D53D9Fb7BCfd8F7fb73AC2",
    tokenSetsBasicIssuanceModule: "0x8a070235a4B9b477655Bf4Eb65a1dB81051B3cC1",
  },
};
const owner = "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b";

async function main() {
  console.log(process.env.HARDHAT_NETWORK);
  const TokenSetAdapterFactory = await hre.ethers.getContractFactory("TokenSetAdapter");
  const tokenSetAdapter = await TokenSetAdapterFactory.deploy(
    deployedContracts[process.env.HARDHAT_NETWORK ?? "mainnet"].tokenSetsBasicIssuanceModule,
    deployedContracts[process.env.HARDHAT_NETWORK ?? "mainnet"].genericRouter,
    owner,
  );
  await tokenSetAdapter.deployed();
  console.log("TokenSetAdapter: ", tokenSetAdapter.address);

  const IndexedAdapterFactory = await hre.ethers.getContractFactory("IndexedAdapter");
  const indexedAdapter = await IndexedAdapterFactory.deploy(owner);
  await indexedAdapter.deployed();
  console.log("IndexedAdapter: ", indexedAdapter.address);

  const PieDaoAdapterFactory = await hre.ethers.getContractFactory("PieDaoAdapter");
  const pieDaoAdapter = await PieDaoAdapterFactory.deploy(owner);
  await pieDaoAdapter.deployed();
  console.log("PieDaoAdapter: ", pieDaoAdapter.address);

  const unlock = await getBlockTime(60);

  const LiquidityMigrationFactory = await hre.ethers.getContractFactory("LiquidityMigration");
  const liquidityMigration = await LiquidityMigrationFactory.deploy(
    [tokenSetAdapter.address, indexedAdapter.address, pieDaoAdapter.address],
    deployedContracts[process.env.HARDHAT_NETWORK ?? "mainnet"].genericRouter,
    deployedContracts[process.env.HARDHAT_NETWORK ?? "mainnet"].strategyProxyFactory,
    deployedContracts[process.env.HARDHAT_NETWORK ?? "mainnet"].strategyController,
    unlock,
    hre.ethers.constants.MaxUint256,
    owner,
  );
  await liquidityMigration.deployed();
  console.log("LiquidityMigration: ", liquidityMigration.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
