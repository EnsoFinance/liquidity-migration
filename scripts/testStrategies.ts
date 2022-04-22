import hre from "hardhat";
import { BigNumber, Contract } from "ethers";
import { DeployedContracts } from "../src/types";
import { ENSO_CONTRACTS_MULTISIG, ENSO_TREASURY_MULTISIG } from "../src/constants";
import { impersonateAccount, liveMigrationContract, getPoolsToMigrate } from "../src/mainnet";
import { increaseTime } from "../src/utils";
import { getLiveContracts } from "@ensofinance/v1-core";
import deployedStrategies from "../out/deployed_strategies.json";
import deployments from "../deployments.json";
const Strategy = require("@ensofinance/v1-core/artifacts/contracts/Strategy.sol/Strategy.json");

const slippage = "980";
const knownIssues = ["0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2b", "0x68bB81B3F67f7AAb5fd1390ECB0B8e1a806F2465"]; // DPI (KNC liquidity), NFTP (old AXS)

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const enso = getLiveContracts(signer);

  //Test Strategies
  const strategies: DeployedContracts = deployedStrategies;
  const lps = Object.keys(strategies);
  let errorCount = 0;
  for (let i = 0; i < lps.length; i++) {
    const lp = lps[i];
    const strategyAddress = strategies[lp];
    if (!knownIssues.includes(lp)) {
      const strategy = new Contract(strategyAddress, Strategy.abi, signer);
      try {
        console.log("Testing strategy: ", strategyAddress, `(${lp})`);
        console.log("Depositing...");
        const value = hre.ethers.constants.WeiPerEther;
        await enso.platform.controller.deposit(strategyAddress, enso.routers.full.address, 0, slippage, "0x", {
          value: value,
        });
        console.log("Success");
        const balance = await strategy.balanceOf(signer.address);
        console.log("Balance: ", balance.toString());
        const supportsSynths = await strategy.supportsSynths();
        if (supportsSynths) {
          console.log("Withdrawing all...");
          await increaseTime(1000);
          await strategy.withdrawAll(balance);
        } else {
          try {
            console.log("Withdrawing ETH...");
            await enso.platform.controller.withdrawETH(
              strategyAddress,
              enso.routers.full.address,
              balance,
              slippage,
              "0x",
            );
          } catch (e) {
            console.log(e);
            console.log("Withdraw ETH failed, withdrawing all...");
            await strategy.withdrawAll(balance);
          }
        }
        console.log("Success");
      } catch (e) {
        errorCount++;
        console.log(e);
      }
    } else {
      console.log("Skipping: ", strategyAddress, `(${lp})`);
    }
  }
  console.log("Number of Errors: ", errorCount);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
