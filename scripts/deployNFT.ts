// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from "hardhat";
import { getBlockTime } from "../src/utils";
import * as fs from "fs";
import deployments from "../deployments.json";

const lockPeriod = 2419200 // 4 weeks
const monoRepoDeployments = process.env.MONOREPO_DEPLOYMENTS_FILE;
const network = process.env.HARDHAT_NETWORK ?? "localhost";

const { AddressZero } = hre.ethers.constants


const LiquidityMigration = "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b"; // UPDATE
const owner = "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b"; // UPDATE
const initialURI = "https://gateway.pinata.cloud/ipfs/QmcdPdMj7kjvctaG1YLH3cn7RB1cbHrbu4wzPVGaSu821G/{id}.json"

https://gateway.pinata.cloud/ipfs/Qmcoqx2GTGYdu3eUQtYtxbRNvPvuMRxVuLp2CgjTbc9KnN/{id}.json

const max = 6;
const supply = 1000;
const protocol_addresses = [
    '0x',
    '0x',
    '0x',
    '0x',
    '0x',
    '0x'
]

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

/*
    1. IndexCoop    : 0000000000000000000000000000000000000000000000000000000000000000
    2. Indexed      : 0000000000000000000000000000000000000000000000000000000000000001
    3. Powerpool    : 0000000000000000000000000000000000000000000000000000000000000002
    4. Tokensets    : 0000000000000000000000000000000000000000000000000000000000000003
    5. dHedge       : 0000000000000000000000000000000000000000000000000000000000000004
    6. PieDAO       : 0000000000000000000000000000000000000000000000000000000000000005
    7. Master       : 0000000000000000000000000000000000000000000000000000000000000006
*/

async function main() {
    const ERC1155Factory = await hre.ethers.getContractFactory("Root1155");
    const erc1155 = await ERC1155Factory.deploy(initialURI);
    log("ERC1155", erc1155.address);

    // const Claimable = await hre.ethers.getContractFactory("Claimable");
    // const claimable = await Claimable.deploy(LiquidityMigration, erc1155.address, max, protocol_addresses);
    // for (let i = 0; i <= max; i++) {
    //   await erc1155.create(claimable.address, supply, initialURI, "0x");
    // }
    // log("Claimable", claimable.address);
    // await claimable.stateChange(STATE.ACTIVE);
    // console.log("State updated: Migrate all the competitors *evil laugh*");
    // write2File();
}
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



// 0000000000000000000000000000000000000000000000000000000000000001