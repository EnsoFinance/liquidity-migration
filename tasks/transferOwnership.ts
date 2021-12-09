import { task } from "hardhat/config";
import { TRANSFER_OWNERSHIP } from "./task-names";
import { getOwner } from "./whitelistStrategy";
import { Ownable__factory } from "../typechain";
import deployments from "../deployments.json";
const prompts = require("prompts");

task(TRANSFER_OWNERSHIP, "Transfer ownership to new wallet")
  .addParam("to", "address to transfer ownership to")
  .setAction(async ({ to }, hre) => {
    const owner = await getOwner(hre);
    const signer = await hre.ethers.getSigner(owner);
    // @ts-ignore
    const lm = deployments[hre.network.name].LiquidityMigration;
    if (!lm) throw Error("Liquidity Migration not deployed");
    const ownable = Ownable__factory.connect(lm, signer);
    const currentOwner = await ownable.owner();
    console.log("Current Owner: ", currentOwner);
    if (currentOwner && currentOwner!= signer.address) throw Error("Not owner");
    const response = await prompts({
      type: "toggle",
      name: "value",
      message: `Are you sure you want to transfer ownership to: ${to} ?`,
      initial: true,
      active: "yes",
      inactive: "no",
    });
    switch (response.value) {
      case true:
        const tx = await ownable.transferOwnership(to);
        await tx.wait();
        console.log("Success!")
        console.log("New Owner: ", await ownable.owner());
        break;
      case false:
        console.log("Exiting....Owner remains: ", await ownable.owner());
        break;
      default:
        console.log("Invalid answer!. Type y or n");
    }
  });
