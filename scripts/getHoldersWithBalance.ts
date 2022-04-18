import hre from "hardhat";
import { BigNumber } from "ethers";
import { getPoolsToMigrate, getErc20Holder } from "../src/mainnet";
import { write2File } from "../src/utils";
import { StakedPools, Erc20Holders } from "../src/types";

const NUM_BLOCKS = 2000;

// Check for any addresses that hold the list of tokens from getPoolsToMigrate
async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer.provider) throw Error("No ethereum provider");
  const poolsToMigrate: StakedPools[] = await getPoolsToMigrate(signer);
  const holders: Erc20Holders = {};
  const currentBlock = await signer.provider.getBlockNumber();
  for (let i = 0; i < poolsToMigrate.length; i++) {
    const pool = poolsToMigrate[i];
    try {
      const holder = await getErc20Holder(pool.lp, currentBlock - NUM_BLOCKS, currentBlock, signer);
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
