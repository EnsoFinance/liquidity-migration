import { task } from "hardhat/config";
import { WHITELIST_STRATEGY } from "./task-names";
export const owner = "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b";
const ABI_FRAGMENT = [
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
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner],
    });
    const secondSigner = await hre.ethers.getSigner(owner);
    const { add, isWhitelisted } = await new hre.ethers.Contract(adapterAddress, ABI_FRAGMENT, secondSigner);
    await add(strategyAddress);
    const strategyIsWhitelisted = await isWhitelisted(strategyAddress);
    console.log(`${strategyAddress} is${strategyIsWhitelisted ? "" : "not"} whitelisted`);
  });
