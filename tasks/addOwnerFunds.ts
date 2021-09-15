import { task } from "hardhat/config";
import { ADD_OWNER_FUNDS } from "./task-names";
export const owner = "0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b";
const ethereumHolder = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";

task(ADD_OWNER_FUNDS, "Add Owner Funds", async (_taskArgs, hre) => {
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
});
