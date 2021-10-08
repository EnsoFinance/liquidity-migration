import { task } from "hardhat/config";
import deployments from "../deployments.json";

import { WHITELIST_ALL_STRATEGIES } from "./task-names";
import { LP_TOKEN_WHALES } from "./initMasterUser";
import { ADAPTER_ABI_FRAGMENT, owner } from "./whitelistStrategy";
import { MIGRATION_ABI_FRAGMENT } from "./addAdapter";
const network = "localhost";

task(WHITELIST_ALL_STRATEGIES, "Whitelist all whale strategies", async (_taskArgs, hre) => {
  for (const { lpTokenAddress, adapter } of LP_TOKEN_WHALES) {
    if (adapter) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deployedAdapter = deployments[network][adapter];
      const liquidityMigrationAddress = deployments[network].LiquidityMigration;
      if (deployedAdapter) {
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: [owner],
        });
        const signer = await hre.ethers.getSigner(owner);
        const { add } = await new hre.ethers.Contract(deployedAdapter, ADAPTER_ABI_FRAGMENT, signer);
        const { addAdapter } = await new hre.ethers.Contract(liquidityMigrationAddress, MIGRATION_ABI_FRAGMENT, signer);
        await addAdapter(deployedAdapter);
        await add(lpTokenAddress);
      }
    }
  }
});
