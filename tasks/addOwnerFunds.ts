import { task } from "hardhat/config";
import { ADD_OWNER_FUNDS } from "./task-names";
import { getOwner } from "./whitelistStrategy";
const ethereumHolder = "0x9bf4001d307dfd62b26a2f1307ee0c0307632d59";

task(ADD_OWNER_FUNDS, "Add Owner Funds", async (_taskArgs, hre) => {
  const owner = await getOwner(hre);
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
