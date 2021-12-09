import { task } from "hardhat/config";
import deployments from "../deployments.json";

import { WHITELIST_ALL_STRATEGIES } from "./task-names";
import { LP_TOKEN_WHALES } from "./initMasterUser";
import { ADAPTER_ABI_FRAGMENT, getOwner } from "./whitelistStrategy";

task(WHITELIST_ALL_STRATEGIES, "Whitelist all whale strategies", async (_taskArgs, hre) => {
  const owner = await getOwner(hre);
  const network = process.env.HARDHAT_NETWORK ?? hre.network.name;
  for (const { lpTokenAddress, adapter } of LP_TOKEN_WHALES) {
    try {
      if (adapter) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const deployedAdapter = deployments[network][adapter];
        if (deployedAdapter) {
          const signer = await hre.ethers.getSigner(owner);
          const adapter = await hre.ethers.getContractAt("AbstractAdapter", deployedAdapter, signer )
          const isWhitelisted = await adapter.isWhitelisted(lpTokenAddress);
          if (!isWhitelisted) {
          await adapter.add(lpTokenAddress);
          console.log("Added strategy ", lpTokenAddress, " to adapter ", deployedAdapter);
          } else {
            console.log("Lp already added: ", lpTokenAddress)
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
});
