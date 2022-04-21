import hre from "hardhat";
import { BigNumber } from "ethers";
import { getPoolsToMigrate } from "../src/mainnet";
import { StrategyParamsMapJson, StrategyParamsJson, StrategyParams } from "../src/types";
import { write2File, getStrategyCreationParams, toJsonStrategyParams } from "../src/utils";
import { getLiveContracts, InitialState } from "@ensofinance/v1-core";

export const INITIAL_STATE: InitialState = {
  timelock: BigNumber.from(0),
  rebalanceThreshold: BigNumber.from(50), // 5%
  rebalanceSlippage: BigNumber.from(995), // 99.5 %
  restructureSlippage: BigNumber.from(990), // 99 %
  performanceFee: BigNumber.from(0),
  social: true,
  set: false,
};

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const enso = getLiveContracts(signer);
  const manager = "0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F"; //treasury
  const stakedPools = await getPoolsToMigrate(signer);
  const lps = Object.keys(stakedPools);
  let numErrors = 0;
  let errs: string[] = [];
  const creationParams: StrategyParamsMapJson = {};
  for (let i = 0; i < lps.length; i++) {
    const pool = stakedPools[lps[i]];
    if (!pool) throw Error(`Failed to find data for pool: ${lps[i]}`);
    if (pool.lp.toLowerCase() !== "0x126c121f99e1e211df2e5f8de2d96fa36647c855") {
      //DEGEN
      try {
        let params: StrategyParams = await getStrategyCreationParams(
          signer,
          enso,
          pool.lp,
          manager,
          pool.adapter.address,
          INITIAL_STATE,
        );
        //console.log(params);
        const paramsJson: StrategyParamsJson = toJsonStrategyParams(params) as StrategyParamsJson;
        creationParams[lps[i]] = paramsJson;
      } catch (err: any) {
        //console.log(err);
        numErrors++;
        errs.push(err.toString());
      }
    } else {
      numErrors++;
      errs.push("Cant support DEGEN")
    }
  }
  if (numErrors) {
    console.log("\nFailed to create params for ", numErrors, "/", lps.length, " pools");
    write2File("strategy_creation_errors", errs);
    console.log("Errors written to: out/strategy_creation_errors");
  }
  write2File("strategy_creation_inputs.json", creationParams);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
