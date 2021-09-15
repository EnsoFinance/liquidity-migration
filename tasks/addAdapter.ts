import { task } from "hardhat/config";
import { ADD_ADAPTER } from "./task-names";
export const owner = "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b";
const ABI_FRAGMENT = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_adapter",
        type: "address",
      },
    ],
    name: "addAdapter",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

task(ADD_ADAPTER, "Add Adapters")
  .addParam("adapterAddress", "Add adapter address")
  .addParam("migrationAddress", "Liquidity migration address")
  .setAction(async ({ adapterAddress, migrationAddress }, hre) => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner],
    });
    const secondSigner = await hre.ethers.getSigner(owner);
    const { addAdapter } = await new hre.ethers.Contract(migrationAddress, ABI_FRAGMENT, secondSigner);
    await addAdapter(adapterAddress);
  });
