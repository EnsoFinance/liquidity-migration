import hre from "hardhat";
import { BigNumber } from "ethers";
import { getPoolsToMigrate, getErc20Holder } from "../src/mainnet";
import { write2File } from "../src/utils";
import { PoolMapJson, Erc20HoldersJson, HolderBalanceJson } from "../src/types";
import allStakes from "../out/stakes_to_migrate.json";

const NUM_BLOCKS = 2000;

// Check for any addresses that hold the list of tokens from getPoolsToMigrate
async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer.provider) throw Error("No ethereum provider");
  const lps: string[] = Object.keys(allStakes);
  const holders: Erc20HoldersJson = {};
  const lpPools: PoolMapJson = allStakes;
  const currentBlock = await signer.provider.getBlockNumber();
  for (let i = 0; i < lps.length; i++) {
    console.log(`Finding erc20 holder for pool: ${lps[i]}`, i, "/", lps.length);
    const lp: string = lps[i];
    const pool = lpPools[lp];
    if (!pool) throw Error(`Failed to find pool for ${lps[i]}`);
    try {
      const holder: HolderBalanceJson = await getErc20Holder(pool.lp, currentBlock - NUM_BLOCKS, currentBlock, signer);
      if (!holder) throw Error(`Failed to find token holder for ${pool.lp}`);
      holders[pool.lp] = holder;
    } catch {
      console.log("No holder found for: ", pool.lp);
    }
  }
  write2File("erc20_holders.json", holders);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
