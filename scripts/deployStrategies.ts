import hre from "hardhat";
import { StrategyParamsJson } from "../src/types";
import { getLiveContracts } from "@ensofinance/v1-core";
import {
  waitForLowGas,
  waitForTransaction,
  getExpectedBaseFee,
  TransactionArgs,
} from "@ensofinance/crawler/lib/common";
import creationParameters from "../out/strategy_creation_inputs.json";

async function main() {
  let overwrite = false;
  const [signer] = await hre.ethers.getSigners();
  if (!signer.provider) throw Error("Signer has no provider");
  // load deployed contracts file
  const enso = getLiveContracts(signer);
  const lps = Object.keys(creationParameters);
  const paramsJson: StrategyParamsJson = creationParameters;
  for (let i = 0; i < lps.length; i++) {
    const currentBlock = await signer.provider.getBlockNumber();
    const params = creationParameters[lps[i]];
    // TODO: if (!deployed || overwrite)
    // TODO: leverage
    const strategy = await waitForTransaction(async (txArgs: TransactionArgs) => {
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
    console.log(strategy);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
