import { task } from "hardhat/config";
import deployments from "../deployments.json";

import { ADD_ALL_ADAPTERS } from "./task-names";
import { LP_TOKEN_WHALES } from "./initMasterUser";
import { owner } from "./whitelistStrategy";
import { MIGRATION_ABI_FRAGMENT } from "./addAdapter";
const network = "localhost";

task(ADD_ALL_ADAPTERS, "Add all adapters", async (_taskArgs, hre) => {
  const uniqueAdapters = [];
  for (const { adapter } of LP_TOKEN_WHALES) {
    if (adapter && uniqueAdapters.indexOf(adapter) === -1) {
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
        const { addAdapter, adapters } = await new hre.ethers.Contract(
          liquidityMigrationAddress,
          MIGRATION_ABI_FRAGMENT,
          signer,
        );
        const isAlreadyAdapter = await adapters(deployedAdapter);
        console.log(`${deployedAdapter} ${!isAlreadyAdapter ? "was not" : "was"} already added`);
        if (!isAlreadyAdapter) {
          await addAdapter(deployedAdapter);
          uniqueAdapters.push(adapter);
        }
      }
    }
  }
});
