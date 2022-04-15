import hre from "hardhat";
import { BigNumber } from "ethers";
import { getPoolsToMigrate, getErc20Holder } from "../src/mainnet";
import { PoolsToMigrate, HolderWithBalance, HoldersWithBalance } from "../src/types";
import { write2File } from "../src/utils";
const NUM_BLOCKS = 1000;
async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer.provider) throw Error("No provider attached to signer");
  const poolsToMigrate: PoolsToMigrate[] = await getPoolsToMigrate(signer);
  const holders: HoldersWithBalance = {};
  const currentBlock = await signer.provider.getBlockNumber();
  if (!currentBlock) throw Error("Failed to find current block");
  const startBlock = currentBlock - NUM_BLOCKS;
  for (let i = 0; i < poolsToMigrate.length; i++) {
    const pool = poolsToMigrate[i];
    console.log("Checking pool: ", pool.lp);
    const holder = await getErc20Holder(pool.lp, startBlock, currentBlock, signer);
    if (!holder) throw Error(`Failed to find holder for: ${pool.lp}`);
    console.log("Found holder: ", holder);
    holders[pool.lp] = holder;
    write2File("erc20_holders.json", holders);
    /*
    try {
      const holder: HolderWithBalance = await getHolderWithBalance(pool.balances, pool.lp, signer);
      holders[pool.lp] = holder;
    } catch {
      console.log("No holder found for: ", pool.lp);
    }
    */
  }
  console.log(holders);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
