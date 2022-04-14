import hre from "hardhat";
import { BigNumber } from "ethers";
import { getPoolsToMigrate, getHolderWithBalance } from "../src/mainnet";
import { PoolsToMigrate, HolderWithBalance, HoldersWithBalance } from "../src/types";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const poolsToMigrate: PoolsToMigrate[] = await getPoolsToMigrate(signer);
  const holders: HoldersWithBalance = {};
  for (let i = 0; i < poolsToMigrate.length; i++) {
    const pool = poolsToMigrate[i];
    console.log("Checking for pool: ", pool.balances);
    const holder: HolderWithBalance = await getHolderWithBalance(pool.balances, pool.lp, signer);
    holders[pool.lp] = holder;
  }
  console.log(holders);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
