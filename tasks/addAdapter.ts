import { task } from "hardhat/config";
import { ADD_ADAPTER } from "./task-names";
export const owner = "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b";
const ERC20_ABI_FRAGMENT = [
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

const ethereumHolder = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";

task(ADD_ADAPTER, "Add Adapters")
  .addParam("adapterAddress", "Add adapter address")
  .setAction(async ({ adapterAddress }, hre) => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ethereumHolder],
    });
    const signer = await hre.ethers.getSigner(ethereumHolder);
    await signer.sendTransaction({ to: owner, value: hre.ethers.utils.parseEther("20") });
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [ethereumHolder],
    });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner],
    });
    const secondSigner = await hre.ethers.getSigner(owner);
    const contract = await new hre.ethers.Contract(adapterAddress, ERC20_ABI_FRAGMENT, secondSigner);
    const tx = await contract.addAdapter(adapterAddress);
    console.log(tx);
  });
