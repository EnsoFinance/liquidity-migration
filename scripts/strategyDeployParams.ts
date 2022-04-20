import hre from "hardhat";
import { BigNumber } from "ethers";
import { getAllStakers } from "../src/mainnet";
import { StrategyParamsMapJson, StrategyParamsJson, StrategyParams } from "../src/types";
import { write2File, getStrategyCreationParams, toJsonStrategyParams } from "../src/utils";
import { getLiveContracts, InitialState } from "@ensofinance/v1-core";

export const INITIAL_STATE: InitialState = {
  timelock: BigNumber.from(60), // 1 minute
  rebalanceThreshold: BigNumber.from(50), // 5%
  rebalanceSlippage: BigNumber.from(997), // 99.7 %
  restructureSlippage: BigNumber.from(995), // 99.5 %
  performanceFee: BigNumber.from(0),
  social: true,
  set: false,
};

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const enso = getLiveContracts(signer);
  const manager = await enso.platform.strategyFactory.owner();
  const stakedPools = await getAllStakers(signer);
  const lps = Object.keys(stakedPools);
  let numErrors = 0;
  const creationParams: StrategyParamsMapJson = {};
  for (let i = 0; i < lps.length; i++) {
    const pool = stakedPools[lps[i]];
    if (!pool) throw Error(`Failed to find data for pool: ${lps[i]}`);
    try {
      let params: StrategyParams = await getStrategyCreationParams(
        signer,
        enso,
        pool.lp,
        manager,
        pool.adapter,
        INITIAL_STATE,
      );
      const paramsJson: StrategyParamsJson = toJsonStrategyParams(params) as StrategyParamsJson;
      creationParams[lps[i]] = paramsJson;
    } catch (err) {
      console.log(err);
      numErrors++;
    }
  }
  if (numErrors) {
    console.log("\nFailed to create params for ", numErrors, "/", lps.length, " pools");
  }
  write2File("strategy_creation_inputs.json", creationParams);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
