import { task } from "hardhat/config";
import deployments from "../deployments.json";

import { WHITELIST_MIGRATION_ADAPTER } from "./task-names";
import { LP_TOKEN_WHALES } from "./initMasterUser";
import { ADAPTER_ABI_FRAGMENT, getOwner } from "./whitelistStrategy";

task(WHITELIST_MIGRATION_ADAPTER, "Whitelist all strategies on migration adapter", async (_taskArgs, hre) => {
  const owner = await getOwner(hre);
  const network = process.env.HARDHAT_NETWORK ?? hre.network.name;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const deployedAdapter = deployments[network]['MigrationAdapter'];
  if (deployedAdapter) {
    for (const { lpTokenAddress } of LP_TOKEN_WHALES) {
      try {
          const signer = await hre.ethers.getSigner(owner);
          const adapter = await hre.ethers.getContractAt("AbstractAdapter", deployedAdapter, signer )
          const isWhitelisted = await adapter.isWhitelisted(lpTokenAddress);
          if (!isWhitelisted) {
            await adapter.add(lpTokenAddress);
            console.log("Added strategy ", lpTokenAddress, " to adapter ", deployedAdapter);
          } else {
            console.log("Lp already added: ", lpTokenAddress)
          }
      } catch (e) {
        console.log(e);
      }
    }
  }
});
