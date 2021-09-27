// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'
import { getBlockTime } from '../src/utils'

const deployedContracts = {
  mainnet: {
    genericRouter: '',
    strategyProxyFactory: '',
    strategyController: '',
    tokenSetsBasicIssuanceModule: '0xd8EF3cACe8b4907117a45B0b125c68560532F94D'
  },
  kovan: {
    genericRouter: '0xE0a9382c01d6EDfA0c933714b3626435EeF10811',
    strategyProxyFactory: '0xaF80BB1794B887de4a6816Ab0219692a21e8430e',
    strategyController: '0x077a70998D5086E6c6D53D9Fb7BCfd8F7fb73AC2',
    tokenSetsBasicIssuanceModule: '0x8a070235a4B9b477655Bf4Eb65a1dB81051B3cC1'
  },
  localhost: {
    genericRouter: '0xE0a9382c01d6EDfA0c933714b3626435EeF10811',
    strategyProxyFactory: '0xaF80BB1794B887de4a6816Ab0219692a21e8430e',
    strategyController: '0x077a70998D5086E6c6D53D9Fb7BCfd8F7fb73AC2',
    tokenSetsBasicIssuanceModule: '0x8a070235a4B9b477655Bf4Eb65a1dB81051B3cC1'
  }
}

const owner = '0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b'
const initialURI = 'https://token-cdn-domain/{id}.json'
const max = 3
const protocols = [0, 1, 2] // 0 = TS, 1 = pie, 3 = indexed
const supply = 1000
const state = [0, 1, 2] // 0 = pending, 1 = active, 2 = closed



async function main() {
    let protocol_addresses = [];
    const TokenSetAdapterFactory = await hre.ethers.getContractFactory("TokenSetAdapter")
    const tokenSetAdapter = await TokenSetAdapterFactory.deploy(
        deployedContracts['localhost'].tokenSetsBasicIssuanceModule,
        deployedContracts['localhost'].genericRouter,
        owner
    )
    await tokenSetAdapter.deployed()
    console.log("TokenSetAdapter: ", tokenSetAdapter.address)
    protocol_addresses.push(tokenSetAdapter.address)

    const IndexedAdapterFactory = await hre.ethers.getContractFactory("IndexedAdapter")
    const indexedAdapter = await IndexedAdapterFactory.deploy(owner)
    await indexedAdapter.deployed()
    console.log("IndexedAdapter: ", indexedAdapter.address)
    protocol_addresses.push(indexedAdapter.address)

    const PieDaoAdapterFactory = await hre.ethers.getContractFactory("PieDaoAdapter")
    const pieDaoAdapter = await PieDaoAdapterFactory.deploy(owner);
    await pieDaoAdapter.deployed()
    console.log("PieDaoAdapter: ", pieDaoAdapter.address)
    protocol_addresses.push(pieDaoAdapter.address)

    const unlock = await getBlockTime(60)

    const LiquidityMigrationFactory = await hre.ethers.getContractFactory("LiquidityMigration")
    const liquidityMigration = await LiquidityMigrationFactory.deploy(
      [tokenSetAdapter.address, indexedAdapter.address, pieDaoAdapter.address],
      deployedContracts['localhost'].genericRouter,
      deployedContracts['localhost'].strategyProxyFactory,
      deployedContracts['localhost'].strategyController,
      unlock,
      hre.ethers.constants.MaxUint256,
      owner
    )
    await liquidityMigration.deployed()
    console.log("LiquidityMigration: ", liquidityMigration.address)

    const ERC1155Factory = await hre.ethers.getContractFactory("Root1155");
    const erc1155 = await ERC1155Factory.deploy(initialURI)
    console.log("ERC1155: ", erc1155.address)

    const Claimable = await hre.ethers.getContractFactory("Claimable");
    const claimable = await Claimable.deploy(
        liquidityMigration.address,
        erc1155.address,
        max,
        protocol_addresses)
    for (let i = 0; i < max; i++) {
        await erc1155.create(
            claimable.address,
            supply,
            initialURI,
            "0x"
        )
    }
    console.log("Claimable:", claimable.address)
    await claimable.stateChange(state[1])
    console.log("State updated: Migrate all the competitors *evil laugh*")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })