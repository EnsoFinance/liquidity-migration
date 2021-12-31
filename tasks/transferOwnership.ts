import { task } from "hardhat/config";
import { TRANSFER_OWNERSHIP } from "./task-names";
import { getOwner } from "./whitelistStrategy";
import { Ownable__factory } from "../typechain";
import deployments from "../deployments.json";
const prompts = require("prompts");


task(TRANSFER_OWNERSHIP, "Transfer ownership to new wallet")
  .addParam("to", "address to transfer ownership to")
  .setAction(async ({ to }, hre) => {
    const network = process.env.HARDHAT_NETWORK ?? hre.network.name;
    const owner = await getOwner(hre);
    const signer = await hre.ethers.getSigner(owner);
    // @ts-ignore
    const deployment = deployments[network]
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
        const keys = Object.keys(deployment);
        for (let i = 0; i < keys.length; i++) {
          // @ts-ignore
          const value = deployment[keys[i]]
          if (value) {
            //@ts-ignore
            const ownable = Ownable__factory.connect(value, signer);
            const currentOwner = await ownable.owner();
            console.log(`\n${keys[i]} Current Owner: `, currentOwner);
            if (currentOwner && currentOwner == signer.address) {
                console.log("Transferring ownership...")
                const estimatedGasPrice = await signer.getGasPrice()
                const gasPrice = estimatedGasPrice.add(estimatedGasPrice.div(10))
                
                const tx = await ownable.transferOwnership(to, { gasPrice: gasPrice });
                await tx.wait();
                console.log("Success!")
                console.log(`${keys[i]} New Owner: `, await ownable.owner());
            } else {
                console.log("Not owner")
            }

          }
        }
        break;
      case false:
        console.log("Exiting....No owner change");
        break;
      default:
        console.log("Invalid answer!. Type y or n");
    }
  });
