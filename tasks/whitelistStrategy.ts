import { task } from "hardhat/config";
import { MASTER_USER } from "./initMasterUser";
import { WHITELIST_STRATEGY } from "./task-names";

export const getOwner = async (hre: any) => {
  const network = process.env.HARDHAT_NETWORK ?? hre.network.name;
  if (network != "localhost") {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer: ", deployer.address);
    console.log("Network: ", network);
    return deployer.address;
  } else {
    const owner = MASTER_USER;
    console.log("Deployer: ", owner);
    console.log("Network: ", network);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner],
    });
    return owner;
  }
};
export const ADAPTER_ABI_FRAGMENT = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_token",
        type: "address",
      },
    ],
    name: "add",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_lp",
        type: "address",
      },
    ],
    name: "isWhitelisted",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

task(WHITELIST_STRATEGY, "Whitelist Strategy")
  .addParam("adapterAddress", "Add adapter address")
  .addParam("strategyAddress", "Add strategy address")
  .setAction(async ({ strategyAddress, adapterAddress }, hre) => {
    const owner = await getOwner(hre);
    const secondSigner = await hre.ethers.getSigner(owner);
    const { add, isWhitelisted } = await new hre.ethers.Contract(adapterAddress, ADAPTER_ABI_FRAGMENT, secondSigner);
    await add(strategyAddress);
    const strategyIsWhitelisted = await isWhitelisted(strategyAddress);
    console.log(`${strategyAddress} is${strategyIsWhitelisted ? "" : "not"} whitelisted`);
  });
