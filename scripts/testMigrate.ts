import hre from "hardhat";
import { BigNumber, Contract } from "ethers";
import { DeployedContracts } from "../src/types";
import { ENSO_CONTRACTS_MULTISIG, ENSO_TREASURY_MULTISIG } from "../src/constants";
import { impersonateAccount, liveMigrationContract, getPoolsToMigrate } from "../src/mainnet";
import { getLiveContracts } from "@ensofinance/v1-core";
import deployedStrategies from "../out/deployed_strategies.json";
import deployments from "../deployments.json";
const Strategy = require("@ensofinance/v1-core/artifacts/contracts/Strategy.sol/Strategy.json");
const ERC20 = require("@ensofinance/v1-core/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const enso = getLiveContracts(signer);

  //Impersonate Treasury Multisig
  const treasury = await impersonateAccount(ENSO_TREASURY_MULTISIG);
  const liquidityMigration = await liveMigrationContract(treasury);

  //Set Strategies in LiquidityMigrationV2
  /*
  const strategies: DeployedContracts = deployedStrategies;
  const lps = Object.keys(strategies);
  for (let i = 0; i < lps.length; i++) {
    const lp = lps[i];
    try {
      console.log("Setting strategy: ", lp, strategies[lp]);
      await liquidityMigration.setStrategy(lp, strategies[lp]);
    } catch (e) {
      console.log(e);
    }
  }
  */

  //Migrate Strategies
  const strategies: DeployedContracts = deployedStrategies;
  const lps = Object.keys(strategies);
  const stakedPools = await getPoolsToMigrate(signer);
  for (let i = 2; i < lps.length; i++) {
    const lp = lps[i];
    const strategyAddress = strategies[lp];
    const erc20 = new Contract(lp, ERC20.abi, signer);
    const strategy = new Contract(strategyAddress, Strategy.abi, signer);
    const pool = stakedPools[lp];
    if (pool) {
      const balance = await erc20.balanceOf(liquidityMigration.address);
      console.log("Balance: ", balance.toString());
      try {
        const estimate = await enso.platform.oracles.ensoOracle["estimateItem(uint256,address)"](balance, lp);
        console.log("Estimate: ", estimate.toString());
      } catch (e) {
        console.log("Cannot estimate LP");
      }
      try {
        console.log("Migrating: ", lp, pool.adapter.address);
        await liquidityMigration.migrateAll(lp, pool.adapter.address);
        const [total] = await enso.platform.oracles.ensoOracle.estimateStrategy(strategyAddress);
        console.log("Total: ", total.toString());
      } catch (e) {
        console.log(e);
      }
      const balances = pool.balances;
      const stakers = Object.keys(balances);
      let summedBalances = BigNumber.from(0);
      for (let i = 0; i < stakers.length; i++) {
        const user = await impersonateAccount(stakers[i]);
        try {
          await liquidityMigration.connect(user).claim(lp);
          const strategyBalance = await strategy.balanceOf(user.address);
          console.log("User balance: ", strategyBalance.toString());
          summedBalances = summedBalances.add(strategyBalance);
        } catch (e) {
          console.log("Claim fail");
        }
      }
      console.log("Summed Balances: ", summedBalances.toString());
    }
  }
  /*
  //Impersonate Upgrade Multisig
  const upgrades = await impersonateAccount(ENSO_CONTRACTS_MULTISIG);

  //Update StrategyController implementation
  await enso.platform.administration.platformProxyAdmin
    .connect(upgrades)
    .upgrade(enso.platform.controller.address, "0x43DaCf2d9E6fb37449Bb962986219aE787d80cc3");
    */
  //Test Strategies
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
