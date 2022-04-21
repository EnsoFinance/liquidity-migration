import hre from "hardhat";
import { getAllStakers } from "../src/mainnet";
import { write2File } from "../src/utils";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const stakers = await getAllStakers(signer);
  write2File("all_stakes.json", stakers);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
