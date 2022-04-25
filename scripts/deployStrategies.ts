import hre from "hardhat";
import { Event } from "ethers";
import { StrategyParamsMapJson, StrategyParams } from "../src/types";
import { getLiveContracts } from "@ensofinance/v1-core";
import { waitForTransaction, TransactionArgs } from "./common";
import { write2File, fromJsonStrategyParams } from "../src/utils";
import { DeployedContracts } from "../src/types";
import creationParameters from "../out/strategy_creation_inputs.json";
import deployments from "../deployments.json";

const contracts: DeployedContracts = {};
const log = (contractTitle: string, address: string) => {
  contracts[contractTitle] = address;
  console.log(contractTitle + ": " + address);
};

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? hre.network.name;
  const [signer] = await hre.ethers.getSigners();
  if (!signer.provider) throw Error("Signer has no provider");
  // load deployed contracts file
  const enso = getLiveContracts(signer);
  const paramsJson: StrategyParamsMapJson = creationParameters;
  const lps = Object.keys(paramsJson);
  for (let i = 0; i < lps.length; i++) {
    const currentBlock = await signer.provider.getBlockNumber();
    const params: StrategyParams = fromJsonStrategyParams(paramsJson[lps[i]]);
    try {
      const receipt = await waitForTransaction(async (txArgs: TransactionArgs) => {
        return enso.platform.strategyFactory.createStrategy(
          params.manager,
          params.name,
          params.symbol,
          params.items,
          params.state,
          hre.ethers.constants.AddressZero,
          "0x",
          txArgs,
        );
      }, signer);
      const strategyAddress = receipt.events.find((ev: Event) => ev.event === "NewStrategy").args.strategy;
      log(lps[i], strategyAddress);
    } catch (err) {
      console.log(err);
    }
  }
  write2File("deployed_strategies.json", contracts);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
