import { task } from "hardhat/config";
import { ADD_ADAPTER } from "./task-names";
import { getOwner } from "./whitelistStrategy"

export const MIGRATION_ABI_FRAGMENT = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_adapter",
        type: "address",
      },
    ],
    name: "addAdapter",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "adapters",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

task(ADD_ADAPTER, "Add Adapters")
  .addParam("adapterAddress", "Add adapter address")
  .addParam("migrationAddress", "Liquidity migration address")
  .setAction(async ({ adapterAddress, migrationAddress }, hre) => {
    const owner = await getOwner(hre);

    const signer = await hre.ethers.getSigner(owner);
    const { addAdapter, adapters } = await new hre.ethers.Contract(migrationAddress, MIGRATION_ABI_FRAGMENT, signer);
    const isAlreadyAdapter = await adapters(adapterAddress);
    console.log(`${adapterAddress} ${!isAlreadyAdapter ? "was not" : "was"} already added`);
    if (!isAlreadyAdapter) {
      await addAdapter(adapterAddress);
    }
  });
